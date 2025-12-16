const mongoose = require("mongoose");

const personSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  dni: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
  },
  address: {
    type: String,
    required: true,
  },
  financialStatus: {
    type: String,
    required: true, // e.g., 'Good', 'Bad', 'Unknown'
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  observation: {
    type: String,
    default: "",
  },
  documents: [
    {
      type: String, // URLs to images/documents
    },
  ],
  // Verification checks
  dniChecked: {
    type: Boolean,
    default: false,
  },
  estadoFinancieroChecked: {
    type: Boolean,
    default: false,
  },
  carpetaCompletaChecked: {
    type: Boolean,
    default: false,
  },
  boletaServicioChecked: {
    type: Boolean,
    default: false,
  },
  garanteChecked: {
    type: Boolean,
    default: false,
  },
  verificacionChecked: {
    type: Boolean,
    default: false,
  },
  // Rejection fields per check
  dniRejection: {
    type: Boolean,
    default: false,
  },
  dniRejectionReason: {
    type: String,
    default: "",
  },
  estadoFinancieroRejection: {
    type: Boolean,
    default: false,
  },
  estadoFinancieroRejectionReason: {
    type: String,
    default: "",
  },
  carpetaCompletaRejection: {
    type: Boolean,
    default: false,
  },
  carpetaCompletaRejectionReason: {
    type: String,
    default: "",
  },
  boletaServicioRejection: {
    type: Boolean,
    default: false,
  },
  boletaServicioRejectionReason: {
    type: String,
    default: "",
  },
  garanteRejection: {
    type: Boolean,
    default: false,
  },
  garanteRejectionReason: {
    type: String,
    default: "",
  },
  verificacionRejection: {
    type: Boolean,
    default: false,
  },
  verificacionRejectionReason: {
    type: String,
    default: "",
  },
  // soft-delete/archive flag when removed from group
  archived: {
    type: Boolean,
    default: false,
  },
  archivedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual to check if person is apt for credit (all checks true and no rejections)
personSchema.virtual("isApt").get(function () {
  return !!(
    this.dniChecked &&
    this.estadoFinancieroChecked &&
    this.carpetaCompletaChecked &&
    this.boletaServicioChecked &&
    this.garanteChecked &&
    this.verificacionChecked &&
    !this.dniRejection &&
    !this.estadoFinancieroRejection &&
    !this.carpetaCompletaRejection &&
    !this.boletaServicioRejection &&
    !this.garanteRejection &&
    !this.verificacionRejection
  );
});

personSchema.set("toJSON", { virtuals: true });
personSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Person", personSchema);
