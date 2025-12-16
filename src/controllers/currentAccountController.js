const CurrentAccount = require("../models/CurrentAccount");
const Loan = require("../models/Loan");
const Person = require("../models/Person");

// @desc    Get all current accounts
// @route   GET /api/current-accounts
// @access  Private (admin/administrativo)
exports.getCurrentAccounts = async (req, res) => {
  try {
    const accounts = await CurrentAccount.find()
      .populate({
        path: "person",
        populate: {
          path: "group",
          model: "Group",
        },
      })
      .populate("loan");
    res
      .status(200)
      .json({ success: true, count: accounts.length, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get current account by ID
// @route   GET /api/current-accounts/:id
// @access  Private (admin/administrativo)
exports.getCurrentAccount = async (req, res) => {
  try {
    const account = await CurrentAccount.findById(req.params.id)
      .populate("person")
      .populate("loan");
    if (!account)
      return res
        .status(404)
        .json({ success: false, error: "Account not found" });
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get current account by person ID
// @route   GET /api/current-accounts/person/:personId
// @access  Private (admin/administrativo)
exports.getCurrentAccountByPerson = async (req, res) => {
  try {
    const account = await CurrentAccount.findOne({
      person: req.params.personId,
    })
      .populate("person")
      .populate("loan");
    if (!account)
      return res
        .status(404)
        .json({ success: false, error: "Account not found" });
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get current account by group ID
// @route   GET /api/current-accounts/group/:groupId
// @access  Private (admin/administrativo)
exports.getCurrentAccountByGroup = async (req, res) => {
  try {
    const account = await CurrentAccount.findOne({
      group: req.params.groupId,
    })
      .populate("group")
      .populate("loan");
    if (!account)
      return res
        .status(404)
        .json({ success: false, error: "Account not found" });
    // Además agregamos totales agregados a partir de las cuentas de persona
    const personAccounts = await CurrentAccount.find({
      loan: account.loan._id,
      accountType: "person",
    });

    let aggPaid = 0;
    let aggUnpaid = 0;
    for (const pa of personAccounts) {
      aggPaid += (pa.installments || [])
        .filter((i) => i.status === "paid")
        .reduce((s, it) => s + (it.amount || 0), 0);
      aggUnpaid += (pa.installments || [])
        .filter((i) => i.status !== "paid")
        .reduce((s, it) => s + (it.amount || 0), 0);
    }

    // Incluir totales agregados en la respuesta bajo `personTotals`
    const data = account.toObject();
    data.personTotals = { totalPaid: aggPaid, totalUnpaid: aggUnpaid };

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new current account (called when loan is created)
// @route   POST /api/current-accounts
// @access  Private (admin)
exports.createCurrentAccount = async (req, res) => {
  try {
    const { personId, groupId, loanId, totalAmount, installments } = req.body;

    // If personId is provided, create a person account (existing behavior)
    if (personId) {
      const person = await Person.findById(personId);
      if (!person)
        return res
          .status(404)
          .json({ success: false, error: "Person not found" });

      const loan = loanId ? await Loan.findById(loanId) : null;
      if (loanId && !loan)
        return res
          .status(404)
          .json({ success: false, error: "Loan not found" });

      const account = await CurrentAccount.create({
        person: personId,
        loan: loanId || null,
        totalAmount: totalAmount || 0,
        installments: installments || [],
        status: "active",
      });

      await account.populate([{ path: "person" }, { path: "loan" }]);
      return res.status(201).json({ success: true, data: account });
    }

    // If groupId is provided, create a group-level account (manual)
    if (groupId) {
      const group = await require("../models/Group").findById(groupId);
      if (!group)
        return res
          .status(404)
          .json({ success: false, error: "Group not found" });

      const loan = loanId ? await Loan.findById(loanId) : null;
      if (loanId && !loan)
        return res
          .status(404)
          .json({ success: false, error: "Loan not found" });

      const account = await CurrentAccount.create({
        group: groupId,
        person: null,
        loan: loanId || null,
        accountType: "group",
        totalAmount: totalAmount || 0,
        installments: installments || [],
        status: "active",
      });

      await account.populate([{ path: "group" }, { path: "loan" }]);
      return res.status(201).json({ success: true, data: account });
    }

    return res
      .status(400)
      .json({ success: false, error: "personId or groupId required" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update installment (mark as paid)
// @route   PUT /api/current-accounts/:id/installments/:installmentNumber
// @access  Private (admin)
exports.updateInstallment = async (req, res) => {
  try {
    const { id, installmentNumber } = req.params;
    const { paidDate, status, observation } = req.body;

    const account = await CurrentAccount.findById(id);
    if (!account)
      return res
        .status(404)
        .json({ success: false, error: "Account not found" });

    const installment = account.installments.find(
      (i) => i.installmentNumber === parseInt(installmentNumber)
    );
    if (!installment)
      return res
        .status(404)
        .json({ success: false, error: "Installment not found" });

    if (paidDate) installment.paidDate = paidDate;

    // Handle payment amount
    if (req.body.amountPaid !== undefined) {
      const payment = parseFloat(req.body.amountPaid);
      installment.amountPaid = (installment.amountPaid || 0) + payment;

      // Auto-update status based on amount paid
      if (installment.amountPaid >= installment.amount - 0.01) { // Tolerance for float
        installment.status = "paid";
        if (!installment.paidDate) installment.paidDate = new Date();
      } else if (installment.amountPaid > 0) {
        installment.status = "partial";
      }
    } else if (status) {
      // Manual status override
      installment.status = status;
    }

    if (observation) installment.observation = observation;
    if (req.body.dueDate) installment.dueDate = req.body.dueDate;

    account.updatedAt = new Date();
    await account.save();

    await account.populate([{ path: "person" }, { path: "loan" }]);
    const populated = account;
    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Get collections (paid installments) by date range
// @route   GET /api/current-accounts/collections
// @access  Private (admin/administrativo)
exports.getCollections = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    if (endDate && endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
    }

    const collections = await CurrentAccount.aggregate([
      { $unwind: "$installments" },
      {
        $match: {
          "installments.status": "paid",
          "installments.paidDate": { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "people",
          localField: "person",
          foreignField: "_id",
          as: "personData",
        },
      },
      {
        $lookup: {
          from: "groups",
          localField: "group",
          foreignField: "_id",
          as: "groupData",
        },
      },
      {
        $project: {
          _id: 1,
          accountType: 1,
          person: { $arrayElemAt: ["$personData", 0] },
          group: { $arrayElemAt: ["$groupData", 0] },
          installment: "$installments",
        },
      },
      { $sort: { "installment.paidDate": -1 } },
    ]);

    res
      .status(200)
      .json({ success: true, count: collections.length, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Close/suspend account
// @route   PATCH /api/current-accounts/:id
// @access  Private (admin)
exports.updateAccountStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const account = await CurrentAccount.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    )
      .populate("person")
      .populate("loan");
    if (!account)
      return res
        .status(404)
        .json({ success: false, error: "Account not found" });
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
