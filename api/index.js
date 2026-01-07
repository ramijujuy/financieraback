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
app.post("/api/auth/register", authController.register);
app.post("/api/auth/login", authController.login);
app.get("/api/auth/me", protect, authController.getMe);
app.put("/api/auth/updatedetails", protect, authController.updateDetails);
app.put("/api/auth/updatepassword", protect, authController.updatePassword);

// Shareholders
app.get("/api/shareholders", protect, shareholderController.getShareholders);
app.post("/api/shareholders", protect, authorize("admin"), shareholderController.createShareholder);
app.get("/api/shareholders/profits", protect, authorize("admin", "administrativo"), shareholderController.getShareholderProfits);
app.get("/api/shareholders/:id/account", protect, authorize("admin", "administrativo"), shareholderController.getShareholderAccount);
app.get("/api/shareholders/:id", protect, shareholderController.getShareholder);
app.put("/api/shareholders/:id", protect, authorize("admin"), shareholderController.updateShareholder);
app.delete("/api/shareholders/:id", protect, authorize("admin"), shareholderController.deleteShareholder);

// Groups
app.get("/api/groups", groupController.getGroups);
app.post("/api/groups", isStaff, groupController.createGroup);
app.get("/api/groups/:id", groupController.getGroup);
app.put("/api/groups/:id", protect, groupController.updateGroup);
app.post("/api/groups/:groupId/members", groupController.addMember);
app.delete("/api/groups/:groupId/members/:memberId", protect, groupController.removeMember);
app.get("/api/groups/:id/eligibility", protect, groupController.getGroupEligibility);
app.put("/api/groups/members/:memberId", isStaff, groupController.updateMemberStatus);
app.post("/api/groups/recalculate/status", protect, authorize("admin"), groupController.recalculateGroupsStatus);

// Loans
app.get("/api/loans", protect, authorize("admin", "administrativo"), loanController.getLoans);
app.post("/api/loans", protect, authorize("admin"), loanController.createLoan);
app.get("/api/loans/:id", protect, authorize("admin", "administrativo"), loanController.getLoan);

// Users
app.get("/api/users", protect, authorize("admin"), userController.getUsers);
app.post("/api/users", protect, authorize("admin"), userController.createUser);
app.get("/api/users/:id", protect, authorize("admin"), userController.getUser);
app.put("/api/users/:id", protect, authorize("admin"), userController.updateUser);
app.delete("/api/users/:id", protect, authorize("admin"), userController.deleteUser);

// Persons
app.get("/api/persons", protect, authorize("admin", "administrativo"), personController.getPersons);
app.post("/api/persons", protect, authorize("admin", "administrativo"), personController.createPerson);
app.put("/api/persons/:id/group", protect, authorize("admin", "administrativo"), personController.updatePersonGroup);
app.delete("/api/persons/:id", protect, authorize("admin"), personController.archivePerson);
app.get("/api/persons/:id", protect, authorize("admin", "administrativo"), personController.getPerson);
app.put("/api/persons/:id", protect, authorize("admin", "administrativo"), personController.updatePerson);

// Current Accounts
app.get("/api/current-accounts", protect, authorize("admin", "administrativo"), currentAccountController.getCurrentAccounts);
app.post("/api/current-accounts", protect, authorize("admin"), currentAccountController.createCurrentAccount);
app.get("/api/current-accounts/collections", protect, authorize("admin", "administrativo"), currentAccountController.getCollections);
app.get("/api/current-accounts/person/:personId", protect, authorize("admin", "administrativo"), currentAccountController.getCurrentAccountByPerson);
app.get("/api/current-accounts/group/:groupId", protect, authorize("admin", "administrativo"), currentAccountController.getCurrentAccountByGroup);
app.get("/api/current-accounts/:id", protect, authorize("admin", "administrativo"), currentAccountController.getCurrentAccount);
app.patch("/api/current-accounts/:id", protect, authorize("admin"), currentAccountController.updateAccountStatus);
app.put("/api/current-accounts/:id/installments/:installmentNumber", protect, authorize("admin", "administrativo"), currentAccountController.updateInstallment);

app.get("/", (req, res) => {
    res.json({ ok: true, msg: "API Running with Flattened Routes" });
});

module.exports = app;
