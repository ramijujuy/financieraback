const express = require("express");
const {
  getGroups,
  getGroup,
  createGroup,
  addMember,
  updateMemberStatus,
  removeMember,
  getGroupEligibility,
  recalculateGroupsStatus,
  updateGroup,
} = require("../controllers/groupController");

const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.route("/").get(getGroups).post(createGroup);

router.route("/:id").get(getGroup).put(protect, updateGroup);

router.route("/:groupId/members").post(addMember);

router.route("/members/:memberId").put(updateMemberStatus);

router
  .route("/:groupId/members/:memberId")
  .delete(authorize("admin"), removeMember);

router.route("/:id/eligibility").get(authorize("admin"), getGroupEligibility);

router
  .route("/recalculate/status")
  .post(authorize("admin"), recalculateGroupsStatus);

module.exports = router;
