const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendPasswordResetEmail } = require("../utils/email");

// @desc Register a new customer
// @route POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, firstName, lastName, email, password, phone } = req.body;
  const resolvedName = name || [firstName, lastName].filter(Boolean).join(" ");
  if (!resolvedName || !email || !password) {
    res.status(400);
    throw new Error("Name, email and password are required");
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(400);
    throw new Error("An account with this email already exists");
  }

  const user = await User.create({
    name: resolvedName,
    firstName: firstName || "",
    lastName: lastName || "",
    email,
    password,
    phone,
    role: "customer",
  });

  res.status(201).json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @desc Login (customer, admin, or owner - same endpoint)
// @route POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || "").toLowerCase() }).select("+password");

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been disabled");
  }

  res.json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @desc Get logged-in user's profile
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user.toSafeObject());
});

// @desc Update own profile (name, phone, addresses)
// @route PUT /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, firstName, lastName, phone, bio, profileImage, themePreference } = req.body;
  if (firstName !== undefined) req.user.firstName = firstName;
  if (lastName !== undefined) req.user.lastName = lastName;
  if (firstName !== undefined || lastName !== undefined) {
    req.user.name = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.name;
  } else if (name) {
    req.user.name = name;
  }
  if (phone !== undefined) req.user.phone = phone;
  if (bio !== undefined) req.user.bio = bio;
  if (profileImage !== undefined) req.user.profileImage = profileImage;
  if (themePreference !== undefined) req.user.themePreference = themePreference;
  await req.user.save();
  res.json(req.user.toSafeObject());
});

// @desc Change own password
// @route PUT /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (!(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }
  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated successfully" });
});

// House / Flat No. is optional everywhere in this app (see Checkout.jsx/Profile.jsx) - Street
// is the one address line that's always required, since frontend validation alone never stops a
// direct API call. Deliberately does NOT require city/state/pincode here: the frontend already
// enforces those for new input, and being lenient at this layer avoids rejecting a save for a
// field this endpoint doesn't otherwise police.
const requireStreet = (body, res) => {
  if (!body.street || !String(body.street).trim()) {
    res.status(400);
    throw new Error("Street is required");
  }
};

// @desc Add a new saved address
// @route POST /api/auth/addresses
const addAddress = asyncHandler(async (req, res) => {
  requireStreet(req.body, res);
  req.user.addresses.push(req.body);
  await req.user.save();
  res.status(201).json(req.user.addresses);
});

// @desc Update an existing saved address (e.g. changing its location, or editing its fields)
// @route PUT /api/auth/addresses/:addressId
const updateAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }
  // A location-only update (e.g. re-pinning the map, see Profile.jsx's confirmLocation) never
  // sends `street` at all - only reject when the request explicitly tries to blank it out.
  if (Object.prototype.hasOwnProperty.call(req.body, "street")) {
    requireStreet(req.body, res);
  }
  Object.assign(address, req.body);
  await req.user.save();
  res.json(req.user.addresses);
});

// @desc Delete a saved address
// @route DELETE /api/auth/addresses/:addressId
const deleteAddress = asyncHandler(async (req, res) => {
  req.user.addresses = req.user.addresses.filter((a) => a._id.toString() !== req.params.addressId);
  await req.user.save();
  res.json(req.user.addresses);
});

// @desc Request a password reset email. Always responds with a generic success message,
// whether or not the email exists, so this endpoint can't be used to discover which emails
// are registered.
// @route POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const genericMessage = "If an account exists for that email, a password reset link has been sent.";

  if (!email) {
    res.status(400);
    throw new Error("Please provide your email address");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.json({ message: genericMessage });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl, user.name);

  res.json({ message: genericMessage });
});

// @desc Complete a password reset using the emailed token
// @route POST /api/auth/reset-password/:token
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordTokenHash +resetPasswordExpires");

  if (!user) {
    res.status(400);
    throw new Error("This password reset link is invalid or has expired. Please request a new one.");
  }

  user.password = password; // pre-save hook hashes it
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;
  await user.save();

  // Auto-login: the emailed token already proved control of the account, so issuing a
  // fresh JWT here is no less secure than a normal login.
  res.json({
    message: "Password reset successfully.",
    token: generateToken(user._id),
    user: user.toSafeObject(),
  });
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  forgotPassword,
  resetPassword,
};
