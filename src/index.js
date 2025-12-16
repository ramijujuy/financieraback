require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

const app = express(); // forced restart

// Connect to Database
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/shareholders", require("./routes/shareholderRoutes"));
app.use("/api/groups", require("./routes/groupRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/persons", require("./routes/personRoutes"));
app.use("/api/current-accounts", require("./routes/currentAccountRoutes"));

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
