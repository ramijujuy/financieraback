const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser,
} = require("../controllers/userController");

// All routes protected and admin-only
router.use(protect);
router.use(authorize("admin"));

router.route("/").get(getUsers).post(createUser);
router.route("/:id").get(getUser).put(updateUser).delete(deleteUser);

// change password
router.put("/:id/password", updateUserPassword);

module.exports = router;
