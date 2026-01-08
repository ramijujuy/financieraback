require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("../src/config/db");

// Middleware de Autenticacion
const { protect, authorize, isStaff } = require("../src/middleware/auth");

// Import Controllers
const authController = require("../src/controllers/authController");
const shareholderController = require("../src/controllers/shareholderController");
const groupController = require("../src/controllers/groupController");
const loanController = require("../src/controllers/loanController");
const userController = require("../src/controllers/userController");
const personController = require("../src/controllers/personController");
const currentAccountController = require("../src/controllers/currentAccountController");

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

// --- ROUTES DEFINED DIRECTLY ON APP (NO ROUTER) ---

// Auth
app.post("/auth/register", authController.register);
app.post("/auth/login", authController.login);
app.get("/auth/me", protect, authController.getMe);
app.put("/auth/updatedetails", protect, authController.updateDetails);
app.put("/auth/updatepassword", protect, authController.updatePassword);

// Shareholders
app.get("/shareholders", protect, shareholderController.getShareholders);
app.post(
  "/shareholders",
  protect,
  authorize("admin"),
  shareholderController.createShareholder
);
app.get(
  "/shareholders/profits",
  protect,
  authorize("admin", "administrativo"),
  shareholderController.getShareholderProfits
);
app.get(
  "/shareholders/:id/account",
  protect,
  authorize("admin", "administrativo"),
  shareholderController.getShareholderAccount
);
app.get("/shareholders/:id", protect, shareholderController.getShareholder);
app.put(
  "/shareholders/:id",
  protect,
  authorize("admin"),
  shareholderController.updateShareholder
);
app.delete(
  "/shareholders/:id",
  protect,
  authorize("admin"),
  shareholderController.deleteShareholder
);

// Groups
app.get("/groups", groupController.getGroups);
app.post("/groups", isStaff, groupController.createGroup);
app.get("/groups/:id", groupController.getGroup);
app.put("/groups/:id", protect, groupController.updateGroup);
app.post("/groups/:groupId/members", groupController.addMember);
app.delete(
  "/groups/:groupId/members/:memberId",
  protect,
  groupController.removeMember
);
app.get(
  "/groups/:id/eligibility",
  protect,
  groupController.getGroupEligibility
);
app.put(
  "/groups/members/:memberId",
  isStaff,
  groupController.updateMemberStatus
);
app.post(
  "/groups/recalculate/status",
  protect,
  authorize("admin"),
  groupController.recalculateGroupsStatus
);

// Loans
app.get(
  "/loans",
  protect,
  authorize("admin", "administrativo"),
  loanController.getLoans
);
app.post("/loans", protect, authorize("admin"), loanController.createLoan);
app.get(
  "/loans/:id",
  protect,
  authorize("admin", "administrativo"),
  loanController.getLoan
);

// Users
app.get("/users", protect, authorize("admin"), userController.getUsers);
app.post("/users", protect, authorize("admin"), userController.createUser);
app.get("/users/:id", protect, authorize("admin"), userController.getUser);
app.put("/users/:id", protect, authorize("admin"), userController.updateUser);
app.delete(
  "/users/:id",
  protect,
  authorize("admin"),
  userController.deleteUser
);

// Persons
app.get(
  "/persons",
  protect,
  authorize("admin", "administrativo"),
  personController.getPersons
);
app.post(
  "/persons",
  protect,
  authorize("admin", "administrativo"),
  personController.createPerson
);
app.put(
  "/persons/:id/group",
  protect,
  authorize("admin", "administrativo"),
  personController.updatePersonGroup
);
app.delete(
  "/persons/:id",
  protect,
  authorize("admin"),
  personController.archivePerson
);
app.get(
  "/persons/:id",
  protect,
  authorize("admin", "administrativo"),
  personController.getPerson
);
app.put(
  "/persons/:id",
  protect,
  authorize("admin", "administrativo"),
  personController.updatePerson
);

// Current Accounts
app.get(
  "/current-accounts",
  protect,
  authorize("admin", "administrativo"),
  currentAccountController.getCurrentAccounts
);
app.post(
  "/current-accounts",
  protect,
  authorize("admin"),
  currentAccountController.createCurrentAccount
);
app.get(
  "/current-accounts/collections",
  protect,
  authorize("admin", "administrativo"),
  currentAccountController.getCollections
);
app.get(
  "/current-accounts/person/:personId",
  protect,
  authorize("admin", "administrativo"),
  currentAccountController.getCurrentAccountByPerson
);
app.get(
  "/current-accounts/group/:groupId",
  protect,
  authorize("admin", "administrativo"),
  currentAccountController.getCurrentAccountByGroup
);
app.get(
  "/current-accounts/:id",
  protect,
  authorize("admin", "administrativo"),
  currentAccountController.getCurrentAccount
);
app.patch(
  "/current-accounts/:id",
  protect,
  authorize("admin"),
  currentAccountController.updateAccountStatus
);
app.put(
  "/current-accounts/:id/installments/:installmentNumber",
  protect,
  authorize("admin", "administrativo"),
  currentAccountController.updateInstallment
);

app.get("/", (req, res) => {
  res.json({ ok: true, msg: "API Running with Flattened Routes" });
});

module.exports = app;
