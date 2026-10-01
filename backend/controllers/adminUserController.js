const asyncHandler = require("express-async-handler");
const User = require("../models/User");

// @desc List all customers (for admin dashboard)
// @route GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const { role, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
  res.json(users);
});

// @desc Owner grants admin access to an existing user (by email)
// @route POST /api/admin/users/grant-admin
const grantAdmin = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (!user) {
    res.status(404);
    throw new Error("No account found with that email. They must register first.");
  }
  if (user.role === "owner") {
    res.status(400);
    throw new Error("This user is already the owner");
  }
  user.role = "admin";
  await user.save();
  res.json({ message: `${user.name} (${user.email}) now has admin access.`, user: user.toSafeObject() });
});

// @desc Owner revokes admin access, demoting back to customer
// @route POST /api/admin/users/:id/revoke-admin
const revokeAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user.role === "owner") {
    res.status(400);
    throw new Error("Cannot revoke the owner's access");
  }
  user.role = "customer";
  await user.save();
  res.json({ message: `Admin access revoked for ${user.email}`, user: user.toSafeObject() });
});

// @desc Owner disables/enables any non-owner account
// @route PUT /api/admin/users/:id/toggle-active
const toggleActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user.role === "owner") {
    res.status(400);
    throw new Error("Cannot disable the owner's account");
  }
  user.isActive = !user.isActive;
  await user.save();
  res.json({ message: `Account ${user.isActive ? "enabled" : "disabled"}`, user: user.toSafeObject() });
});

module.exports = { listUsers, grantAdmin, revokeAdmin, toggleActive };
