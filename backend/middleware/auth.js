const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

// Verifies JWT, attaches req.user
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      res.status(401);
      throw new Error("Not authorized, account not found or disabled");
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token invalid or expired");
  }
});

// Restricts to admin or owner (staff access)
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "owner")) {
    return next();
  }
  res.status(403);
  throw new Error("Admin access required");
};

// Restricts to owner only (owner can manage other admins)
const ownerOnly = (req, res, next) => {
  if (req.user && req.user.role === "owner") {
    return next();
  }
  res.status(403);
  throw new Error("Owner access required — only the store owner can do this");
};

// Decodes the JWT if one is present, attaching req.user - but NEVER blocks the request if the
// token is missing/invalid. Used on public-but-identity-aware endpoints like analytics tracking
// (see analyticsController.js), where a logged-in customer's activity should be attributed to
// their account, but an anonymous visitor must still be able to call the same endpoint.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    } catch {
      // Invalid/expired token on a public endpoint - just proceed anonymously, don't 401.
    }
  }
  next();
});

module.exports = { protect, adminOnly, ownerOnly, optionalAuth };
