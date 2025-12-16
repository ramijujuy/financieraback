const mongoose = require("mongoose");

const currentAccountSchema = new mongoose.Schema({
  // Referencia a persona o grupo (será uno u otro)
  person: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Person",
    default: null,
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    default: null,
  },
  accountType: {
    type: String,
    enum: ["person", "group"],
    required: true, // Indica si es cuenta de persona o grupo
  },
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Loan",
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true, // monto total del préstamo (o monto divido si es por persona)
  },
  installments: [
    {
      installmentNumber: Number,
      amount: Number,
      dueDate: Date,
      paidDate: {
        type: Date,
        default: null,
      },
      amountPaid: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        enum: ["pending", "paid", "overdue", "partial"],
        default: "pending",
      },
      observation: String,
    },
  ],
  status: {
    type: String,
    enum: ["active", "closed", "suspended"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual para contar cuotas pagadas
currentAccountSchema.virtual("paidCount").get(function () {
  return this.installments.filter((i) => i.status === "paid").length;
});

// Virtual para contar cuotas impagas
currentAccountSchema.virtual("unpaidCount").get(function () {
  return this.installments.filter(
    (i) => i.status === "pending" || i.status === "overdue"
  ).length;
});

// Virtual para total pagado
currentAccountSchema.virtual("totalPaid").get(function () {
  return this.installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
});

// Virtual para total adeudado
currentAccountSchema.virtual("totalUnpaid").get(function () {
  return this.installments
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);
});

currentAccountSchema.set("toJSON", { virtuals: true });
currentAccountSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("CurrentAccount", currentAccountSchema);
