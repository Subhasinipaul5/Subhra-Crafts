const express = require("express");
const router = express.Router();
const { protect, adminOnly, ownerOnly } = require("../middleware/auth");
const { listUsers, grantAdmin, revokeAdmin, toggleActive } = require("../controllers/adminUserController");

router.get("/", protect, adminOnly, listUsers);
router.post("/grant-admin", protect, ownerOnly, grantAdmin);
router.post("/:id/revoke-admin", protect, ownerOnly, revokeAdmin);
router.put("/:id/toggle-active", protect, ownerOnly, toggleActive);

module.exports = router;
