require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("../src/config/db");

const app = express();

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Middleware para conectar Mongo por request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Routes
app.use("/api/auth", require("../src/routes/authRoutes"));
app.use("/api/shareholders", require("../src/routes/shareholderRoutes"));
app.use("/api/groups", require("../src/routes/groupRoutes"));
app.use("/api/loans", require("../src/routes/loanRoutes"));
app.use("/api/users", require("../src/routes/userRoutes"));
app.use("/api/persons", require("../src/routes/personRoutes"));
app.use("/api/current-accounts", require("../src/routes/currentAccountRoutes"));

app.get("/", (req, res) => {
  res.json({ ok: true });
});

// 👇 CLAVE PARA VERCEL
module.exports = app;
