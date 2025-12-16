const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getCurrentAccounts,
  getCurrentAccount,
  getCurrentAccountByPerson,
  createCurrentAccount,
  updateInstallment,
  updateAccountStatus,
  getCollections,
} = require("../controllers/currentAccountController");

// All protected: admin/administrativo can list and get details; only admin can create/update
router.use(protect);

router
  .route("/")
  .get(authorize("admin", "administrativo"), getCurrentAccounts)
  .post(authorize("admin"), createCurrentAccount);

router
  .route("/collections")
  .get(authorize("admin", "administrativo"), getCollections);

router
  .route("/:id")
  .get(authorize("admin", "administrativo"), getCurrentAccount)
  .patch(authorize("admin"), updateAccountStatus);

router
  .route("/person/:personId")
  .get(authorize("admin", "administrativo"), getCurrentAccountByPerson);

router
  .route("/group/:groupId")
  .get(
    authorize("admin", "administrativo"),
    require("../controllers/currentAccountController").getCurrentAccountByGroup
  );

router
  .route("/:id/installments/:installmentNumber")
  .put(authorize("admin"), updateInstallment);

module.exports = router;
