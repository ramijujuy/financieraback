const Group = require("../models/Group");
const Person = require("../models/Person");
const CurrentAccount = require("../models/CurrentAccount");

// Middleware para verificar acceso de usuarios Staff
const { isStaff } = require("../middleware/auth");

// @desc    Get all groups
// @route   GET /api/groups
// @access  Public
exports.getGroups = async (req, res) => {
  try {
    const groups = await Group.find().populate("members");

    const groupsWithStatus = await Promise.all(
      groups.map(async (group) => {
        const account = await CurrentAccount.findOne({
          group: group._id,
          status: "active",
        });

        let totalDebt = 0;
        let isMoroso = false;

        if (account) {
          // Check for linked person accounts to aggregate debt
          const personAccounts = await CurrentAccount.find({
            loan: account.loan,
            accountType: "person",
          });

          if (personAccounts.length > 0) {
            // Aggregate from members
            personAccounts.forEach(pa => {
              (pa.installments || []).forEach(inst => {
                if (inst.status !== "paid") {
                  totalDebt += (inst.amount || 0) - (inst.amountPaid || 0);
                  const debtRemaining = (inst.amount || 0) - (inst.amountPaid || 0);
                  if (debtRemaining > 0.01) {
                    const dueDate = new Date(inst.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (dueDate < today) {
                      isMoroso = true;
                    }
                  }
                }
              });
            });
          } else {
            // Fallback to group account (direct loan)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            account.installments.forEach((inst) => {
              if (inst.status !== "paid") {
                totalDebt += (inst.amount || 0) - (inst.amountPaid || 0);
                const debtRemaining = (inst.amount || 0) - (inst.amountPaid || 0);
                if (debtRemaining > 0.01) {
                  const dueDate = new Date(inst.dueDate);
                  dueDate.setHours(0, 0, 0, 0);

                  if (dueDate < today) {
                    isMoroso = true;
                  }
                }
              }
            });
          }
        }

        const groupObj = group.toObject();
        groupObj.totalDebt = totalDebt;
        groupObj.isMoroso = isMoroso;
        return groupObj;
      })
    );

    res.status(200).json({
      success: true,
      count: groupsWithStatus.length,
      data: groupsWithStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single group
// @route   GET /api/groups/:id
// @access  Public
exports.getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members");

    if (!group) {
      return res.status(404).json({ success: false, error: "Group not found" });
    }

    const account = await CurrentAccount.findOne({
      group: group._id,
      status: "active",
    });

    let totalDebt = 0;
    let isMoroso = false;

    if (account) {
      // Check for linked person accounts to aggregate debt
      const personAccounts = await CurrentAccount.find({
        loan: account.loan,
        accountType: "person",
      });

      if (personAccounts.length > 0) {
        // Aggregate from members
        personAccounts.forEach(pa => {
          (pa.installments || []).forEach(inst => {
            if (inst.status !== "paid") {
              totalDebt += (inst.amount || 0) - (inst.amountPaid || 0);
              const debtRemaining = (inst.amount || 0) - (inst.amountPaid || 0);
              if (debtRemaining > 0.01) {
                const dueDate = new Date(inst.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (dueDate < today) {
                  isMoroso = true;
                }
              }
            }
          });
        });
      } else {
        // Fallback to group account (direct loan)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        account.installments.forEach((inst) => {
          if (inst.status !== "paid") {
            totalDebt += (inst.amount || 0) - (inst.amountPaid || 0);
            const debtRemaining = (inst.amount || 0) - (inst.amountPaid || 0);
            if (debtRemaining > 0.01) {
              const dueDate = new Date(inst.dueDate);
              dueDate.setHours(0, 0, 0, 0);

              if (dueDate < today) {
                isMoroso = true;
              }
            }
          }
        });
      }
    }

    const groupObj = group.toObject();
    groupObj.totalDebt = totalDebt;
    groupObj.isMoroso = isMoroso;

    res.status(200).json({ success: true, data: groupObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new group
// @route   POST /api/groups
// @access  Public
exports.createGroup = async (req, res) => {
  try {
    const group = await Group.create(req.body);
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update group (name)
// @route   PUT /api/groups/:id
// @access  Private
exports.updateGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const group = await Group.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true }
    ).populate("members");

    if (!group) {
      return res.status(404).json({ success: false, error: "Group not found" });
    }

    res.status(200).json({ success: true, data: group });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Add member to group
// @route   POST /api/groups/:groupId/members
// @access  Public
exports.addMember = async (req, res) => {
  try {
    // 1. Create the person with group link
    const person = await Person.create({
      ...req.body,
      group: req.params.groupId,
    });

    // 2. Add person to group
    const group = await Group.findByIdAndUpdate(
      req.params.groupId,
      { $push: { members: person._id } },
      { new: true, runValidators: true }
    ).populate("members");

    if (!group) {
      // Rollback person creation if group not found
      await Person.findByIdAndDelete(person._id);
      return res.status(404).json({ success: false, error: "Group not found" });
    }

    // Recalculate status for the group after adding member
    const activeMembers = group.members.filter((m) => !m.archived);
    const allApt =
      activeMembers.length > 0 &&
      activeMembers.every(
        (m) =>
          m.dniChecked &&
          m.estadoFinancieroChecked &&
          m.carpetaCompletaChecked &&
          m.verificacionChecked &&
          !m.dniRejection &&
          !m.estadoFinancieroRejection &&
          !m.carpetaCompletaRejection &&
          !m.verificacionRejection
      );

    const anyRejected = activeMembers.some(
      (m) =>
        m.dniRejection ||
        m.estadoFinancieroRejection ||
        m.carpetaCompletaRejection ||
        m.verificacionRejection
    );

    if (allApt) group.status = "Approved";
    else if (anyRejected) group.status = "Rejected";
    else group.status = "Pending";

    await group.save();

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Remove member from group (soft remove: archive person but keep record)
// @route   DELETE /api/groups/:groupId/members/:memberId
// @access  Private
exports.removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const person = await Person.findById(memberId);
    if (!person)
      return res
        .status(404)
        .json({ success: false, error: "Member not found" });
    if (String(person.group) !== String(groupId))
      return res.status(400).json({
        success: false,
        error: "Member does not belong to this group",
      });

    // Archive the person and dissociate from group
    person.archived = true;
    person.archivedAt = new Date();
    person.group = null;
    await person.save();

    // Remove from group's members array
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $pull: { members: person._id } },
      { new: true }
    ).populate("members");

    // Recalculate status for the group after removal
    const activeMembers = group.members.filter((m) => !m.archived);
    const allApt =
      activeMembers.length > 0 &&
      activeMembers.every(
        (m) =>
          m.dniChecked &&
          m.estadoFinancieroChecked &&
          m.carpetaCompletaChecked &&
          m.verificacionChecked &&
          !m.dniRejection &&
          !m.estadoFinancieroRejection &&
          !m.carpetaCompletaRejection &&
          !m.verificacionRejection
      );

    const anyRejected = activeMembers.some(
      (m) =>
        m.dniRejection ||
        m.estadoFinancieroRejection ||
        m.carpetaCompletaRejection ||
        m.verificacionRejection
    );

    if (allApt) group.status = "Approved";
    else if (anyRejected) group.status = "Rejected";
    else group.status = "Pending";

    await group.save();

    res.status(200).json({
      success: true,
      data: { group, archivedPersonId: person._id },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Check group eligibility for credit
// @route   GET /api/groups/:id/eligibility
// @access  Private
exports.getGroupEligibility = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members");
    if (!group)
      return res.status(404).json({ success: false, error: "Group not found" });

    const activeMembers = group.members.filter((m) => !m.archived);
    const total = activeMembers.length;
    const aptMembers = activeMembers.filter(
      (m) =>
        m.dniChecked &&
        m.estadoFinancieroChecked &&
        m.carpetaCompletaChecked &&
        m.verificacionChecked &&
        !m.dniRejection &&
        !m.estadoFinancieroRejection &&
        !m.carpetaCompletaRejection &&
        !m.verificacionRejection
    );
    const aptCount = aptMembers.length;
    const eligible = total > 0 && aptCount === total;

    res.status(200).json({
      success: true,
      data: {
        eligible,
        totalMembers: total,
        aptCount,
        notApt: activeMembers
          .filter(
            (m) =>
              !(
                m.dniChecked &&
                m.estadoFinancieroChecked &&
                m.carpetaCompletaChecked &&
                m.verificacionChecked &&
                !m.dniRejection &&
                !m.estadoFinancieroRejection &&
                !m.carpetaCompletaRejection &&
                !m.verificacionRejection
              )
          )
          .map((m) => ({ id: m._id, username: m.fullName })),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update member status (Approve/Reject)
// @route   PUT /api/groups/members/:memberId
// @access  Public
exports.updateMemberStatus = async (req, res) => {
  try {
    // Accept status, observation and individual verification checks
    const {
      status,
      observation,
      dniChecked,
      estadoFinancieroChecked,
      carpetaCompletaChecked,
      verificacionChecked,
    } = req.body;

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (observation !== undefined) updates.observation = observation;
    if (dniChecked !== undefined) updates.dniChecked = dniChecked;
    if (estadoFinancieroChecked !== undefined)
      updates.estadoFinancieroChecked = estadoFinancieroChecked;
    if (carpetaCompletaChecked !== undefined)
      updates.carpetaCompletaChecked = carpetaCompletaChecked;
    if (verificacionChecked !== undefined)
      updates.verificacionChecked = verificacionChecked;

    const person = await Person.findByIdAndUpdate(
      req.params.memberId,
      updates,
      { new: true, runValidators: true }
    );

    if (!person) {
      return res
        .status(404)
        .json({ success: false, error: "Member not found" });
    }

    // Recompute person status: if all verification checks true and no rejections, mark Approved
    if (
      person.dniChecked &&
      person.estadoFinancieroChecked &&
      person.carpetaCompletaChecked &&
      person.verificacionChecked &&
      !person.dniRejection &&
      !person.estadoFinancieroRejection &&
      !person.carpetaCompletaRejection &&
      !person.verificacionRejection
    ) {
      person.status = "Approved";
      await person.save();
    } else if (
      person.dniRejection ||
      person.estadoFinancieroRejection ||
      person.carpetaCompletaRejection ||
      person.verificacionRejection
    ) {
      person.status = "Rejected";
      await person.save();
    }

    // Check group eligibility considering only non-archived members
    if (person.group) {
      const group = await Group.findById(person.group).populate("members");
      if (group) {
        const activeMembers = group.members.filter((m) => !m.archived);
        const allApt =
          activeMembers.length > 0 &&
          activeMembers.every(
            (m) =>
              m.dniChecked &&
              m.estadoFinancieroChecked &&
              m.carpetaCompletaChecked &&
              m.verificacionChecked &&
              !m.dniRejection &&
              !m.estadoFinancieroRejection &&
              !m.carpetaCompletaRejection &&
              !m.verificacionRejection
          );
        const anyRejected = activeMembers.some(
          (m) =>
            m.dniRejection ||
            m.estadoFinancieroRejection ||
            m.carpetaCompletaRejection ||
            m.verificacionRejection
        );

        if (allApt) {
          group.status = "Approved";
        } else if (anyRejected) {
          group.status = "Rejected";
        } else {
          group.status = "Pending";
        }
        await group.save();
      }
    }

    res.status(200).json({ success: true, data: person });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Recalculate all groups status
// @route   POST /api/groups/recalculate/status
// @access  Private (admin)
exports.recalculateGroupsStatus = async (req, res) => {
  try {
    const groups = await Group.find().populate("members");
    const updated = [];

    for (const group of groups) {
      const activeMembers = group.members.filter((m) => !m.archived);

      // Check if all active members are approved
      const allApt =
        activeMembers.length > 0 &&
        activeMembers.every(
          (m) =>
            m.dniChecked &&
            m.estadoFinancieroChecked &&
            m.carpetaCompletaChecked &&
            m.verificacionChecked &&
            !m.dniRejection &&
            !m.estadoFinancieroRejection &&
            !m.carpetaCompletaRejection &&
            !m.verificacionRejection
        );

      // Check if any member has rejections
      const anyRejected = activeMembers.some(
        (m) =>
          m.dniRejection ||
          m.estadoFinancieroRejection ||
          m.carpetaCompletaRejection ||
          m.verificacionRejection
      );

      let newStatus = "Pending";
      if (allApt) {
        newStatus = "Approved";
      } else if (anyRejected) {
        newStatus = "Rejected";
      }

      if (group.status !== newStatus) {
        group.status = newStatus;
        await group.save();
        updated.push({
          groupId: group._id,
          name: group.name,
          oldStatus: group.status,
          newStatus,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Recalculated ${groups.length} groups`,
      updated: updated.length,
      data: updated,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Sync all groups loan statuses based on payments
// @route   POST /api/groups/sync-all-loan-statuses
// @access  Private (admin)
exports.syncAllLoanStatuses = async (req, res) => {
  try {
    const Loan = require("../models/Loan");
    const activeLoans = await Loan.find({ status: "Active" });
    const results = [];

    for (const loan of activeLoans) {
      const personAccounts = await CurrentAccount.find({
        loan: loan._id,
        accountType: "person",
      });

      let allPaid = personAccounts.length > 0;
      for (const acc of personAccounts) {
        if (acc.installments.some((i) => i.status !== "paid")) {
          allPaid = false;
          break;
        }
      }

      if (allPaid) {
        loan.status = "Paid";
        await loan.save();

        const group = await Group.findById(loan.group);
        if (group && group.status === "Active Loan") {
          group.status = "Approved";
          await group.save();
        }

        await CurrentAccount.updateMany(
          { loan: loan._id },
          { status: "closed", updatedAt: new Date() }
        );

        results.push({
          loanId: loan._id,
          groupId: loan.group,
          status: "Fixed",
        });
      }
    }

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Aplicar middleware en rutas específicas
////router.put("/members/:memberId", isStaff, updateMemberStatus);
////router.post("/groups", isStaff, createGroup);
//router.get("/shareholders", isStaff, getShareholders);
