const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  numberOfInstallments: {
    type: Number,
    required: true,
    min: 2,
    max: 6, // 2-6 cuotas
  },
  interestRate: {
    type: Number,
    default: 15, // 15% monthly
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["Active", "Paid", "Default"],
    default: "Active",
  },
  // Accionistas que aportan al préstamo
  shareholders: [
    {
      shareholder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shareholder",
        required: true,
      },
      contributionAmount: {
        type: Number,
        required: true,
      },
    },
  ],
  // Cuotas del grupo (total)
  installments: [
    {
      installmentNumber: Number,
      dueDate: Date,
      amount: Number,
      status: {
        type: String,
        enum: ["pending", "paid", "overdue"],
        default: "pending",
      },
      paidDate: Date,
    },
  ],
  // Detalles por integrante del grupo
  memberDetails: [
    {
      member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Person",
        required: true,
      },
      amountPerPerson: {
        type: Number,
        required: true, // monto dividido entre miembros
      },
      installments: [
        {
          installmentNumber: Number,
          dueDate: Date,
          amount: Number,
          status: {
            type: String,
            enum: ["pending", "paid", "overdue"],
            default: "pending",
          },
          paidDate: Date,
        },
      ],
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Loan", loanSchema);
