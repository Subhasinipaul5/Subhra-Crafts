const nodemailer = require("nodemailer");

const isEmailConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

if (!isEmailConfigured) {
  console.warn(
    "\n⚠️  Email is not configured (SMTP_HOST/PORT/USER/PASS missing in .env).\n" +
    "   'Forgot password' emails will not be sent until you add SMTP credentials.\n" +
    "   Any free SMTP provider works (Gmail App Password, SendGrid, Mailtrap, Brevo, etc).\n"
  );
}

let transporter = null;
if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendPasswordResetEmail(toEmail, resetUrl, userName) {
  if (!transporter) {
    console.warn(`Email not configured - would have sent password reset link to ${toEmail}: ${resetUrl}`);
    return { sent: false, reason: "not_configured" };
  }

  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FBF6EF;">
      <h2 style="color: #4A2140; font-weight: normal; text-align: center;">SubhRa Crafts</h2>
      <p style="text-align: center; letter-spacing: 2px; font-size: 11px; color: #D98FA3; text-transform: uppercase;">Handmade with Love</p>
      <h3 style="color: #4A2140; margin-top: 32px;">Reset Your Password</h3>
      <p style="color: #333;">Hi ${userName || "there"},</p>
      <p style="color: #333;">Click the button below to create a new password. This link expires in 1 hour.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background: #4A2140; color: #FBF6EF; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-size: 14px;">Reset Password</a>
      </div>
      <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email - your password will not change.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: "Reset Your SubhRa Crafts Password",
    html,
  });
  return { sent: true };
}

module.exports = { sendPasswordResetEmail, isEmailConfigured };
