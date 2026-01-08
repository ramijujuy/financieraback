const Person = require("../models/Person");
const Group = require("../models/Group");
const CurrentAccount = require("../models/CurrentAccount");

// @desc    Get all persons
// @route   GET /api/persons
// @access  Private (admin/administrativo)
exports.getPersons = async (req, res) => {
  try {
    const { status, group } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (group) filter.group = group;
    const persons = await Person.find(filter).populate("group");

    const personsWithStatus = await Promise.all(
      persons.map(async (person) => {
        const account = await CurrentAccount.findOne({
          person: person._id,
          status: "active",
        });
        let isMoroso = false;

        if (account) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          account.installments.forEach((inst) => {
            if (inst.status !== "paid") {
              const dueDate = new Date(inst.dueDate);
              dueDate.setHours(0, 0, 0, 0);
              if (dueDate < today) {
                isMoroso = true;
              }
            }
          });
        }

        const personObj = person.toObject();
        if (isMoroso) {
          personObj.status = "Moroso";
        }
        return personObj;
      })
    );

    res.status(200).json({
      success: true,
      count: personsWithStatus.length,
      data: personsWithStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single person
// @route   GET /api/persons/:id
// @access  Private (admin/administrativo)
exports.getPerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id).populate("group");
    if (!person)
      return res
        .status(404)
        .json({ success: false, error: "Person not found" });

    const account = await CurrentAccount.findOne({
      person: person._id,
      status: "active",
    });
    let isMoroso = false;

    if (account) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      account.installments.forEach((inst) => {
        if (inst.status !== "paid") {
          const dueDate = new Date(inst.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            isMoroso = true;
          }
        }
      });
    }

    const personObj = person.toObject();
    if (isMoroso) {
      personObj.status = "Moroso";
    }

    res.status(200).json({ success: true, data: personObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create new person
// @route   POST /api/persons
// @access  Private (admin/administrativo)
exports.createPerson = async (req, res) => {
  try {
    const { fullName, dni, address, financialStatus, group } = req.body;

    // Check if DNI already exists
    const existingPerson = await Person.findOne({ dni });
    if (existingPerson) {
      return res.status(400).json({ success: false, error: "DNI ya existe" });
    }

    const person = new Person({
      fullName,
      dni,
      address,
      financialStatus: financialStatus || "Unknown",
      group: group || null,
      status: "Pending",
    });

    await person.save();

    // Si la persona se asigna a un grupo, agregarla a la lista de miembros
    if (group) {
      await Group.findByIdAndUpdate(group, {
        $push: { members: person._id },
      });

      // Recalculate group status after adding member
      const groupObj = await Group.findById(group).populate("members");
      if (groupObj) {
        const activeMembers = groupObj.members.filter((m) => !m.archived);
        const allApt =
          activeMembers.length > 0 &&
          activeMembers.every(
            (m) =>
              m.dniChecked &&
              m.estadoFinancieroChecked &&
              m.carpetaCompletaChecked &&
              m.verificacionChecked &&
              m.boletaServicioChecked &&
              m.garanteChecked &&
              !m.dniRejection &&
              !m.estadoFinancieroRejection &&
              !m.carpetaCompletaRejection &&
              !m.verificacionRejection &&
              !m.boletaServicioRejection &&
              !m.garanteRejection
          );

        const anyRejected = activeMembers.some(
          (m) =>
            m.dniRejection ||
            m.estadoFinancieroRejection ||
            m.carpetaCompletaRejection ||
            m.verificacionRejection ||
            m.boletaServicioRejection ||
            m.garanteRejection
        );

        if (allApt) groupObj.status = "Approved";
        else if (anyRejected) groupObj.status = "Rejected";
        else groupObj.status = "Pending";

        await groupObj.save();
      }
    }

    const populatedPerson = await person.populate("group");

    res
      .status(201)
      .json({ success: true, data: populatedPerson, groupUpdated: !!group });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update person (checks and basic fields)
// @route   PUT /api/persons/:id
// @access  Private (admin/administrativo)
exports.updatePerson = async (req, res) => {
  try {
    const updates = { ...req.body };
    // prevent changing group via this endpoint
    if (updates.group) delete updates.group;

    const person = await Person.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("group");
    if (!person)
      return res
        .status(404)
        .json({ success: false, error: "Person not found" });

    // Verificar y guardar cambios en estado financiero
    if (updates.estadoFinancieroChecked !== undefined) {
      person.estadoFinancieroChecked = updates.estadoFinancieroChecked;
    }
    await person.save();

    // Recompute person status
    const hasRejections =
      person.dniRejection ||
      person.estadoFinancieroRejection ||
      person.carpetaCompletaRejection ||
      person.verificacionRejection ||
      person.boletaServicioRejection ||
      person.garanteRejection;
    const allChecked =
      person.dniChecked &&
      person.estadoFinancieroChecked &&
      person.carpetaCompletaChecked &&
      person.verificacionChecked &&
      person.boletaServicioChecked &&
      person.garanteChecked;

    if (hasRejections) {
      person.status = "Rejected";
    } else if (allChecked) {
      person.status = "Approved";
    } else {
      person.status = "Pending";
    }
    await person.save();

    // Recalculate group status if person belongs to a group
    if (person.group) {
      const group = await Group.findById(person.group).populate("members");
      if (group) {
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
              m.boletaServicioChecked &&
              m.garanteChecked &&
              !m.dniRejection &&
              !m.estadoFinancieroRejection &&
              !m.carpetaCompletaRejection &&
              !m.verificacionRejection &&
              !m.boletaServicioRejection &&
              !m.garanteRejection
          );

        // Check if any member has rejections
        const anyRejected = activeMembers.some(
          (m) =>
            m.dniRejection ||
            m.estadoFinancieroRejection ||
            m.carpetaCompletaRejection ||
            m.verificacionRejection ||
            m.boletaServicioRejection ||
            m.garanteRejection
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

// @desc    Archive person (soft delete) and remove from group
// @route   DELETE /api/persons/:id
// @access  Private (admin)
exports.archivePerson = async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person)
      return res
        .status(404)
        .json({ success: false, error: "Person not found" });

    // mark archived and remove group association
    const prevGroup = person.group;
    person.archived = true;
    person.archivedAt = new Date();
    person.group = null;
    await person.save();

    if (prevGroup) {
      await Group.findByIdAndUpdate(prevGroup, {
        $pull: { members: person._id },
      });
    }

    res.status(200).json({ success: true, data: person });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update person's group assignment
// @route   PUT /api/persons/:id/group
// @access  Private (admin/administrativo)
exports.updatePersonGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const personId = req.params.id;

    const person = await Person.findById(personId);
    if (!person)
      return res
        .status(404)
        .json({ success: false, error: "Person not found" });

    // Remover de grupo anterior si existe
    if (person.group) {
      await Group.findByIdAndUpdate(person.group, {
        $pull: { members: personId },
      });
    }

    // Asignar nuevo grupo
    person.group = groupId || null;
    await person.save();

    // Agregar a nuevo grupo si existe
    if (groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $push: { members: personId },
      });
    }

    const updatedPerson = await person.populate("group");
    res.status(200).json({ success: true, data: updatedPerson });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
