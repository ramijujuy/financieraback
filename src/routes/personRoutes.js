const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getPersons,
  getPerson,
  createPerson,
  updatePerson,
  updatePersonGroup,
  archivePerson,
} = require("../controllers/personController");

// All protected: allow admin and administrativo to list and update; archive only admin
router.use(protect);

router
  .route("/")
  .get(authorize("admin", "administrativo", "staff"), getPersons)
  .post(authorize("admin", "administrativo", "staff"), createPerson);
router
  .route("/:id")
  .get(authorize("admin", "administrativo", "staff"), getPerson)
  .put(authorize("admin", "administrativo", "staff"), updatePerson)
  .delete(authorize("admin"), archivePerson);

router
  .route("/:id/group")
  .put(authorize("admin", "administrativo", "staff"), updatePersonGroup);

module.exports = router;
