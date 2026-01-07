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

        activeLoans.forEach((loan) => {
          const contrib = loan.shareholders.find(
            (s) => s.shareholder.toString() === sh._id.toString()
          );
          if (contrib) {
            activeCapital += contrib.contributionAmount;

            // Calculate profit
            // Interest = Principal * Rate * Installments
            // Shareholder Profit = Total Interest * (Contribution / Principal)
            const rate = (loan.interestRate || 15) / 100;
            const totalInterest =
              loan.amount * rate * loan.numberOfInstallments;
            const shareFraction = contrib.contributionAmount / loan.amount;
            projectedProfit += totalInterest * shareFraction;
          }
        });

        return {
          ...sh.toObject(),
          activeCapital,
          projectedProfit,
        };
      })
    );

    res
      .status(200)
      .json({ success: true, count: enrichedShareholders.length, data: enrichedShareholders });
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
    const matchStage = {};
    if (type === 'projected') {
      matchStage["installments.dueDate"] = { $gte: start, $lte: end };
      // For projections, we consider all active installments, or maybe pending/future ones.
      // Let's include all for the period to show total expected return.
    } else {
      matchStage["installments.status"] = "paid";
      matchStage["installments.paidDate"] = { $gte: start, $lte: end };
    }

    const payments = await CurrentAccount.aggregate([
      { $unwind: "$installments" },
      {
        $match: matchStage,
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
          paidDate: "$installments.paidDate",
          dueDate: "$installments.dueDate",
          loan: "$loanData",
        },
      },
    ]);

    // 2. Calculate profits
    const shareholderProfits = {}; // Map: shareholderId -> { shareholder, totalProfit, details: [] }

    for (const payment of payments) {
      const loan = payment.loan;
      const amount = payment.installmentAmount;

      // Calculate Interest Fraction
      // interestRate is percentage, e.g. 15
      const rate = (loan.interestRate || 15) / 100;
      const n = loan.numberOfInstallments;
      // Total Interest = P * r * n
      // Total Amount = P * (1 + r * n)
      // Interest Fraction = (P * r * n) / (P * (1 + r * n)) = (r * n) / (1 + r * n)
      const interestFraction = (rate * n) / (1 + rate * n);

      const interestPortion = amount * interestFraction;

      // Distribute to shareholders
      for (const share of loan.shareholders) {
        const shareholderId = share.shareholder.toString();
        const contribution = share.contributionAmount;
        const principal = loan.amount;

        // Share of the loan
        const shareFraction = contribution / principal;

        const profit = interestPortion * shareFraction;

        // Calculate Capital Recovered
        // amount is the full installment amount paid
        // interestPortion is the total interest part of that amount
        // capitalPart is the rest
        const capitalPart = amount - interestPortion;
        const capitalRecovered = capitalPart * shareFraction;

        if (!shareholderProfits[shareholderId]) {
          shareholderProfits[shareholderId] = {
            shareholderId,
            totalProfit: 0,
            totalCapitalRecovered: 0,
            details: [],
          };
        }

        shareholderProfits[shareholderId].totalProfit += profit;
        shareholderProfits[shareholderId].totalCapitalRecovered += capitalRecovered;

        shareholderProfits[shareholderId].details.push({
          loanId: loan._id,
          paidDate: payment.paidDate,
          dueDate: payment.dueDate,
          profit,
          capitalRecovered,
          installmentAmount: amount,
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
