const Loan = require("../models/Loan");
const Group = require("../models/Group");
const Person = require("../models/Person");
const CurrentAccount = require("../models/CurrentAccount");
const Shareholder = require("../models/Shareholder");

// Helper: Calcular cuotas mensuales con 15% de interés mensual
// Parámetros:
// - amount: monto base
// - numberOfInstallments: cantidad de cuotas (2-6)
// - interestRate: 15% (default)
// - startDate: fecha de inicio del préstamo
// Retorna array de cuotas con vencimiento 30 días después de cada período
const calculateInstallments = (
  amount,
  numberOfInstallments,
  interestRate,
  startDate
) => {
  const installments = [];

  const monthlyInterest = interestRate / 100;
  const totalInterest = amount * monthlyInterest * numberOfInstallments;
  const totalWithInterest = amount + totalInterest;
  const amountPerInstallment = totalWithInterest / numberOfInstallments;

  for (let i = 1; i <= numberOfInstallments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + i * 30);

    installments.push({
      installmentNumber: i,
      amount: Math.round(amountPerInstallment * 100) / 100,
      dueDate,
      status: "pending",
      paidDate: null,
    });
  }

  return installments;
};

// @desc    Create a new loan (versión mejorada)
// @route   POST /api/loans
// @access  Private (admin)
exports.createLoan = async (req, res) => {
  try {
    const { groupId, amount, numberOfInstallments, shareholderContributions, memberAmounts } =
      req.body;

    if (
      !groupId ||
      !amount ||
      !numberOfInstallments ||
      shareholderContributions === undefined ||
      shareholderContributions === null
    ) {
      return res.status(400).json({
        success: false,
        error:
          "groupId, amount, numberOfInstallments, y shareholderContributions son requeridos",
      });
    }

    if (numberOfInstallments < 2 || numberOfInstallments > 6) {
      return res.status(400).json({
        success: false,
        error: "Número de cuotas debe estar entre 2 y 6",
      });
    }

    // Validar que el grupo no tiene un préstamo activo en curso
    const existingActiveLoan = await Loan.findOne({
      group: groupId,
      status: { $in: ["Active", "Active Loan"] },
    });

    if (existingActiveLoan) {
      return res.status(400).json({
        success: false,
        error:
          "El grupo ya tiene un préstamo activo. Debe cancelar el préstamo anterior antes de solicitar uno nuevo.",
      });
    }

    // shareholderContributions must be a non-empty array with at least one positive contribution
    if (
      !Array.isArray(shareholderContributions) ||
      shareholderContributions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Debe haber al menos un accionista contribuyendo al préstamo",
      });
    }

    const totalContributions = shareholderContributions.reduce(
      (sum, s) => sum + (s.amount || 0),
      0
    );

    const hasPositive = shareholderContributions.some(
      (s) => (s.amount || 0) > 0
    );
    if (!hasPositive) {
      return res.status(400).json({
        success: false,
        error: "Al menos un accionista debe aportar un monto mayor a 0",
      });
    }
    if (Math.abs(totalContributions - amount) > 0.01) {
      return res.status(400).json({
        success: false,
        error: `Suma de contribuciones (${totalContributions}) debe igualar monto (${amount})`,
      });
    }

    const group = await Group.findById(groupId).populate("members");
    if (!group) {
      return res
        .status(404)
        .json({ success: false, error: "Grupo no encontrado" });
    }

    const allApproved = group.members.every((m) => {
      const allChecks =
        m.dniChecked &&
        m.estadoFinancieroChecked &&
        m.carpetaCompletaChecked &&
        m.verificacionChecked;
      const noRejections =
        !m.dniRejection &&
        !m.estadoFinancieroRejection &&
        !m.carpetaCompletaRejection &&
        !m.verificacionRejection;
      return allChecks && noRejections;
    });

    if (!allApproved) {
      return res.status(400).json({
        success: false,
        error: "Todos los integrantes del grupo deben estar aprobados",
      });
    }

    // Validate memberAmounts if provided
    let finalMemberDetails = [];

    if (memberAmounts && Array.isArray(memberAmounts)) {
      // Validate sum matches total amount
      const sumMemberAmounts = memberAmounts.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      if (Math.abs(sumMemberAmounts - amount) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `La suma de los montos individuales (${sumMemberAmounts}) no coincide con el monto total del préstamo (${amount})`
        });
      }

      // Validate all group members are present
      if (memberAmounts.length !== group.members.length) {
        // It's possible someone gets 0, but usually we expect all members to be listed.
        // Let's ensure every member ID in the group is in memberAmounts
        const memberIds = group.members.map(m => m._id.toString());
        const providedIds = memberAmounts.map(m => m.memberId.toString());

        const allPresent = memberIds.every(id => providedIds.includes(id));
        if (!allPresent) {
          return res.status(400).json({
            success: false,
            error: "Todos los miembros del grupo deben estar incluidos en la distribución de montos."
          });
        }
      }
    }

    for (const contrib of shareholderContributions) {
      const shareholder = await Shareholder.findById(contrib.shareholderId);
      if (!shareholder) {
        return res.status(404).json({
          success: false,
          error: `Accionista ${contrib.shareholderId} no encontrado`,
        });
      }
    }

    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const interestRate = 15;

    // Calculate Group Installments (Total)
    const groupInstallments = calculateInstallments(
      amount,
      numberOfInstallments,
      interestRate,
      startDate
    );

    // Calculate Member Details
    if (memberAmounts && Array.isArray(memberAmounts)) {
      // Variable amounts
      finalMemberDetails = group.members.map(member => {
        const memberAmountObj = memberAmounts.find(m => m.memberId === member._id.toString());
        const amountForMember = memberAmountObj ? Number(memberAmountObj.amount) : 0;

        const memberInst = calculateInstallments(
          amountForMember,
          numberOfInstallments,
          interestRate,
          startDate
        );

        return {
          member: member._id,
          amountPerPerson: amountForMember,
          installments: JSON.parse(JSON.stringify(memberInst))
        };
      });
    } else {
      // Logic for equal split (legacy support or default)
      const numMembers = group.members.length;
      const amountPerMember = amount / numMembers;
      const memberInstallments = calculateInstallments(
        amountPerMember,
        numberOfInstallments,
        interestRate,
        startDate
      );

      finalMemberDetails = group.members.map((member) => ({
        member: member._id,
        amountPerPerson: amountPerMember,
        installments: JSON.parse(JSON.stringify(memberInstallments)),
      }));
    }

    const shareholders = shareholderContributions.map((contrib) => ({
      shareholder: contrib.shareholderId,
      contributionAmount: contrib.amount,
    }));

    const loan = await Loan.create({
      group: groupId,
      amount,
      numberOfInstallments,
      interestRate,
      startDate,
      installments: groupInstallments,
      memberDetails: finalMemberDetails,
      shareholders,
      status: "Active",
    });

    const groupAccount = await CurrentAccount.create({
      group: groupId,
      person: null,
      accountType: "group",
      loan: loan._id,
      totalAmount: amount,
      installments: JSON.parse(JSON.stringify(groupInstallments)),
      status: "active",
    });

    for (const detail of finalMemberDetails) {
      await CurrentAccount.create({
        person: detail.member,
        group: null,
        accountType: "person",
        loan: loan._id,
        totalAmount: detail.amountPerPerson,
        installments: detail.installments,
        status: "active",
      });
    }

    await Group.findByIdAndUpdate(groupId, { status: "Active Loan" });

    const populatedLoan = await Loan.findById(loan._id)
      .populate("group")
      .populate("memberDetails.member")
      .populate("shareholders.shareholder");

    res.status(201).json({ success: true, data: populatedLoan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Get all loans
// @route   GET /api/loans
// @access  Private (admin/administrativo)
exports.getLoans = async (req, res) => {
  try {
    const loans = await Loan.find()
      .populate("group")
      .populate("memberDetails.member")
      .populate("shareholders.shareholder");
    res.status(200).json({ success: true, count: loans.length, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single loan
// @route   GET /api/loans/:id
// @access  Private (admin/administrativo)
exports.getLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate("group")
      .populate("memberDetails.member")
      .populate("shareholders.shareholder");

    if (!loan) {
      return res
        .status(404)
        .json({ success: false, error: "Préstamo no encontrado" });
    }

    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
