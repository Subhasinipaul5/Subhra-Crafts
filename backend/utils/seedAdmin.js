// Run this ONCE with: npm run seed:admin
// Creates (or promotes) the first OWNER account using values from your .env file.
// After running this, log in on the website and change your password from
// the Profile page. Then remove SEED_ADMIN_* lines from your .env for safety.

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

(async () => {
  await connectDB();

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || "Owner";

  if (!email || !password) {
    console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("SEED_ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    user.role = "owner";
    user.isActive = true;
    user.password = password; // reset password every time this script runs, so it always matches .env
    await user.save();
    console.log(`Existing user ${email} promoted to OWNER and password reset.`);
  } else {
    user = await User.create({ name, email, password, role: "owner" });
    console.log(`Owner account created for ${email}.`);
  }

  console.log("Done. Log in on the website with this email and the password from .env,");
  console.log("then go to Profile > Change Password immediately.");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
