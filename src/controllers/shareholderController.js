const Shareholder = require("../models/Shareholder");
const Loan = require("../models/Loan");
const CurrentAccount = require("../models/CurrentAccount");

// @desc    Get all shareholders
// @route   GET /api/shareholders
// @access  Public
exports.getShareholders = async (req, res) => {
  try {
    const shareholders = await Shareholder.find();

    const enrichedShareholders = await Promise.all(
      shareholders.map(async (sh) => {
        const activeLoans = await Loan.find({
          "shareholders.shareholder": sh._id,
          status: "Active",
        });

        let activeCapital = 0;
        let projectedProfit = 0;

        // Use for...of to handle async properly within the map
        for (const loan of activeLoans) {
          const contrib = loan.shareholders.find(
            (s) => s.shareholder.toString() === sh._id.toString()
          );

          if (contrib) {
            activeCapital += contrib.contributionAmount;

            // Calculate FUTURE/Projected profit based on PENDING installments only
            // 1. Get all member accounts for this loan
            const memberAccounts = await CurrentAccount.find({
              loan: loan._id,
              accountType: "person"
            });

            // 2. Sum up interest from UNPAID installments
            let loanRemainingInterest = 0;
            const rate = (loan.interestRate || 15) / 100;

            if (memberAccounts.length > 0) {
              memberAccounts.forEach(acc => {
                // Count pending checks (or overdue)
                const pendingCount = (acc.installments || []).filter(i => i.status !== 'paid').length;
                // Interest per installment = Principal * Rate
                // Principal for this person = acc.totalAmount
                const interestPerInstallment = acc.totalAmount * rate;
                loanRemainingInterest += (interestPerInstallment * pendingCount);
              });
            } else {
              // Fallback if no person accounts (legacy or error), use Group Account projection
              // Assuming Group Account reflects reality (or is virtualized, but here we query DB)
              // This might be tricky if virtualization is only in controller response.
              // Let's rely on Loan definition if no member accounts found.
              // Pending Installments of the Loan itself?
              // The Loan model doesn't track payments directly, GroupAccount does.
              const groupAccount = await CurrentAccount.findOne({ loan: loan._id, accountType: 'group' });
              if (groupAccount) {
                const pendingCount = (groupAccount.installments || []).filter(i => i.status !== 'paid').length;
                // But wait, groupAccount status might not be synced.
                // If we have no Person Accounts, then Group Account is the source of truth.
                const interestPerInstallment = loan.amount * rate;
                loanRemainingInterest += (interestPerInstallment * pendingCount);
              }
            }

            // 3. Shareholder's portion
            const shareFraction = contrib.contributionAmount / loan.amount;
            projectedProfit += loanRemainingInterest * shareFraction;
          }
        }

        return {
          ...sh.toObject(),
          activeCapital,
          projectedProfit,
        };
      })
    );

    res
      .status(200)
      .json({
        success: true,
        count: enrichedShareholders.length,
        data: enrichedShareholders,
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single shareholder
// @route   GET /api/shareholders/:id
// @access  Public
exports.getShareholder = async (req, res) => {
  try {
    const shareholder = await Shareholder.findById(req.params.id);

    if (!shareholder) {
      return res
        .status(404)
        .json({ success: false, error: "Shareholder not found" });
    }

    res.status(200).json({ success: true, data: shareholder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new shareholder
// @route   POST /api/shareholders
// @access  Public
exports.createShareholder = async (req, res) => {
  try {
    const shareholder = await Shareholder.create(req.body);
    res.status(201).json({ success: true, data: shareholder });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update shareholder
// @route   PUT /api/shareholders/:id
// @access  Public
exports.updateShareholder = async (req, res) => {
  try {
    const shareholder = await Shareholder.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!shareholder) {
      return res
        .status(404)
        .json({ success: false, error: "Shareholder not found" });
    }

    res.status(200).json({ success: true, data: shareholder });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Delete shareholder
// @route   DELETE /api/shareholders/:id
// @access  Public
exports.deleteShareholder = async (req, res) => {
  try {
    const shareholder = await Shareholder.findByIdAndDelete(req.params.id);

    if (!shareholder) {
      return res
        .status(404)
        .json({ success: false, error: "Shareholder not found" });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get shareholder account (contributions and future collections)
// @route   GET /api/shareholders/:shareholderId/account
// @access  Private (admin/administrativo)
exports.getShareholderAccount = async (req, res) => {
  try {
    const { shareholderId } = req.params;

    const shareholder = await Shareholder.findById(shareholderId);
    if (!shareholder) {
      return res
        .status(404)
        .json({ success: false, error: "Shareholder not found" });
    }

    // Buscar todos los loans donde este accionista tiene contribuciones
    const loans = await Loan.find({
      "shareholders.shareholder": shareholderId,
    }).populate("group", "name");

    // Construir resumen de contribuciones y cobros futuros
    const contributions = [];
    let totalContributed = 0;

    for (const loan of loans) {
      const contrib = loan.shareholders.find(
        (s) => s.shareholder.toString() === shareholderId
      );

      if (contrib) {
        const loanStatus = loan.status; // Active, Paid, Default
        const groupName = loan.group?.name || "Grupo no encontrado";

        // Calculate profit
        const rate = (loan.interestRate || 15) / 100;
        const totalInterest = loan.amount * rate * loan.numberOfInstallments;
        const shareFraction = contrib.contributionAmount / loan.amount;
        const interest = totalInterest * shareFraction;
        const futureCollection = contrib.contributionAmount + interest;

        contributions.push({
          loanId: loan._id,
          groupName,
          groupId: loan.group?._id,
          contributionAmount: contrib.contributionAmount,
          capital: contrib.contributionAmount,
          interest: interest,
          futureCollection,
          loanStatus,
          startDate: loan.startDate,
          numberOfInstallments: loan.numberOfInstallments,
        });

        totalContributed += contrib.contributionAmount;
      }
    }

    const account = {
      _id: shareholder._id,
      fullName: shareholder.fullName,
      dni: shareholder.dni,
      capitalContributed: shareholder.capitalContributed,
      totalContributed,
      numberOfLoans: contributions.length,
      contributions,
      createdAt: shareholder.createdAt,
    };

    res.status(200).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get shareholder profits by date range
// @route   GET /api/shareholders/profits
// @access  Private (admin/administrativo)
exports.getShareholderProfits = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    if (endDate && endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
    }

    // 1. Find installments in range
    // 1. Find installments in range
    // NOTE: For 'projected', we want PENDING installments in the range.
    // For 'realized', we want PAID installments in the range.

    const matchStage = {};
    if (type === "projected") {
      matchStage["installments.status"] = { $ne: "paid" }; // Pending or partial
      matchStage["installments.dueDate"] = { $gte: start, $lte: end };
    } else {
      matchStage["installments.status"] = "paid";
      matchStage["installments.paidDate"] = { $gte: start, $lte: end };
    }

    const payments = await CurrentAccount.aggregate([
      { $unwind: "$installments" },
      {
        $match: matchStage, // Filter installments
      },
      {
        $lookup: {
          from: "loans",
          localField: "loan",
          foreignField: "_id",
          as: "loanData",
        },
      },
      {
        $unwind: "$loanData",
      },
      {
        $project: {
          installmentAmount: "$installments.amount",
          // For projected, we use dueDate. For realized, paidDate.
          relevantDate: { $ifNull: ["$installments.paidDate", "$installments.dueDate"] },
          dueDate: "$installments.dueDate",
          paidDate: "$installments.paidDate",
          status: "$installments.status",
          loan: "$loanData",
          // Calculate Capital vs Interest breakdown
          // Interest = Principal * Rate
          // Installment = Principal + Interest = Principal * (1 + Rate)
          // Therefore Principal (Capital) = Installment / (1 + Rate)
          // And Interest = Installment - Principal
        },
      },
    ]);

    // 2. Calculate profits
    const shareholderProfits = {}; // Map: shareholderId -> { totalProfit, totalCapitalRecovered, details: [] }

    for (const payment of payments) {
      const loan = payment.loan;
      const amount = payment.installmentAmount;

      // Calculate Interest Fraction & Capital Fraction
      const rate = (loan.interestRate || 15) / 100;
      // Formula: Installment = P_installment * (1 + rate)
      // So P_installment = Installment / (1 + rate)
      const capitalPart = amount / (1 + rate);
      const interestPart = amount - capitalPart;

      // Distribute to shareholders
      for (const share of loan.shareholders) {
        const shareholderId = share.shareholder.toString();
        const contribution = share.contributionAmount;
        const totalPrincipal = loan.amount;

        // Share of the loan
        const shareFraction = contribution / totalPrincipal;

        const profitShare = interestPart * shareFraction;
        const capitalShare = capitalPart * shareFraction;

        if (!shareholderProfits[shareholderId]) {
          shareholderProfits[shareholderId] = {
            shareholderId,
            totalProfit: 0,
            totalCapitalRecovered: 0,
            details: [],
          };
        }

        shareholderProfits[shareholderId].totalProfit += profitShare;
        shareholderProfits[shareholderId].totalCapitalRecovered += capitalShare;

        shareholderProfits[shareholderId].details.push({
          loanId: loan._id,
          paidDate: payment.paidDate,
          dueDate: payment.dueDate,
          profit: profitShare,
          capitalRecovered: capitalShare,
          installmentAmount: amount * shareFraction, // Share of total installment
        });
      }
    }



    // 3. Populate shareholder names
    const result = [];
    for (const id in shareholderProfits) {
      const sh = await Shareholder.findById(id).select("fullName dni");
      if (sh) {
        result.push({
          shareholder: sh,
          totalProfit: shareholderProfits[id].totalProfit,
          totalCapitalRecovered: shareholderProfits[id].totalCapitalRecovered,
          details: shareholderProfits[id].details,
        });
      }
    }

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
