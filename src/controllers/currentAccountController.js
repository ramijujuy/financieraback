const CurrentAccount = require("../models/CurrentAccount");
const Loan = require("../models/Loan");
const Person = require("../models/Person");
const Group = require("../models/Group");

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
      .populate("loan")
      .populate("group");

    const processedAccounts = await Promise.all(
      accounts.map(async (acc) => {
        if (acc.accountType === "group" && acc.loan) {
          try {
            // Virtualize Group Accounts logic
            const personAccounts = await CurrentAccount.find({
              loan: acc.loan._id,
              accountType: "person",
            });

            let totalCollected = 0;
            for (const pa of personAccounts) {
              totalCollected += (pa.installments || [])
                .filter((i) => i.status === "paid")
                .reduce((s, it) => s + (it.amount || 0), 0);
            }

            let fundsRemaining = totalCollected;
            const virtualInsts = acc.installments.map((inst) => {
              const vInst = { ...inst.toObject() };
              if (vInst.status !== "paid") {
                if (fundsRemaining >= vInst.amount - 0.01) {
                  vInst.status = "paid";
                  fundsRemaining -= vInst.amount;
                } else if (fundsRemaining > 0) {
                  vInst.status = "partial";
                  vInst.amountPaid = (vInst.amountPaid || 0) + fundsRemaining;
                  fundsRemaining = 0;
                }
              }
              return vInst;
            });

            const accObj = acc.toObject();
            accObj.installments = virtualInsts;
            return accObj;
          } catch (err) {
            console.error("Error virtualizing group account", err);
            return acc.toObject();
          }
        }
        return acc.toObject();
      })
    );

    res
      .status(200)
      .json({ success: true, count: processedAccounts.length, data: processedAccounts });
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
      status: "active"
    })
      .sort({ createdAt: -1 })
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



    let totalCollected = 0;
    let totalPending = 0;
    for (const pa of personAccounts) {
      totalCollected += (pa.installments || [])
        .filter((i) => i.status === "paid")
        .reduce((s, it) => s + (it.amount || 0), 0);

      totalPending += (pa.installments || [])
        .filter((i) => i.status !== "paid")
        .reduce((s, it) => s + (it.amount || 0) - (it.amountPaid || 0), 0);
    }

    let fundsRemaining = totalCollected;
    const virtualInsts = account.installments.map((inst) => {
      const vInst = { ...inst.toObject() };
      if (vInst.status !== "paid") { // Only pay if not already paid manually
        if (fundsRemaining >= vInst.amount - 0.01) {
          vInst.status = "paid";
          fundsRemaining -= vInst.amount;
        } else if (fundsRemaining > 0) {
          vInst.status = "partial";
          vInst.amountPaid = (vInst.amountPaid || 0) + fundsRemaining;
          fundsRemaining = 0;
        }
      }
      return vInst;
    });

    const dataObj = account.toObject();
    dataObj.installments = virtualInsts;
    dataObj.personTotals = { totalPaid: totalCollected, totalUnpaid: totalPending };

    res.status(200).json({ success: true, data: dataObj });
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
      if (installment.amountPaid >= installment.amount - 0.01) {
        // Tolerance for float
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
    if (req.body.dueDate) {
      const d = new Date(req.body.dueDate);
      d.setHours(12, 0, 0, 0);
      installment.dueDate = d;
    }

    account.updatedAt = new Date();
    await account.save();

    // Check if the loan is fully paid
    if (account.loan) {
      // Only check person-level accounts for loan completion. 
      // Group-level accounts are copies/virtualizations and might not be marked as paid.
      const allPersonAccounts = await CurrentAccount.find({
        loan: account.loan,
        accountType: 'person'
      });

      let allPaid = true;
      for (const acc of allPersonAccounts) {
        const hasUnpaid = acc.installments.some(inst => inst.status !== 'paid');
        if (hasUnpaid) {
          allPaid = false;
          break;
        }
      }

      if (allPaid) {
        // Update Loan Status
        await Loan.findByIdAndUpdate(account.loan, { status: 'Paid' });

        // Find the loan to get the groupId
        const loan = await Loan.findById(account.loan);
        if (loan && loan.group) {
          // Update Group Status back to Approved
          await Group.findByIdAndUpdate(loan.group, { status: 'Approved' });
        }

        // Close all accounts related to this loan
        await CurrentAccount.updateMany(
          { loan: account.loan },
          { status: 'closed', updatedAt: new Date() }
        );
      }
    }

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
