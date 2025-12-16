const express = require("express");
const {
  getShareholders,
  getShareholder,
  createShareholder,
  updateShareholder,
  deleteShareholder,
  getShareholderAccount,
  getShareholderProfits,
} = require("../controllers/shareholderController");

const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router
  .route("/")
  .get(protect, getShareholders)
  .post(protect, authorize("admin"), createShareholder);

router
  .route("/profits")
  .get(protect, authorize("admin", "administrativo"), getShareholderProfits);

router
  .route("/:id/account")
  .get(protect, authorize("admin", "administrativo"), getShareholderAccount);

router
  .route("/:id")
  .get(protect, getShareholder)
  .put(protect, authorize("admin"), updateShareholder)
  .delete(protect, authorize("admin"), deleteShareholder);

module.exports = router;
