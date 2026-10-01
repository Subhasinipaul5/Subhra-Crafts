const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    house: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String,
    isDefault: { type: Boolean, default: false },
    // Customer's own delivery/personal location, set via the map picker in Profile > Addresses.
    // Distinct from Settings.businessLocation (the shop's location, admin-only).
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    locationAddress: { type: String, default: "" }, // human-readable address from reverse geocoding
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // kept for display; kept in sync with firstName+lastName
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    profileImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    bio: { type: String, default: "", maxlength: 500 },
    // Selected color theme (e.g. "rose-luxury"). "default" = the standard SubhRa Crafts palette.
    // Separate from light/dark mode, which stays a per-device localStorage preference.
    themePreference: { type: String, default: "default" },
    // owner = full control incl. managing other admins. admin = staff access. customer = shopper.
    role: { type: String, enum: ["owner", "admin", "customer"], default: "customer" },
    addresses: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    isActive: { type: Boolean, default: true },
    // Password reset - stores only a HASH of the token (never the raw token, same principle
    // as never storing plain-text passwords), plus an expiry. Cleared after successful use.
    resetPasswordTokenHash: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
