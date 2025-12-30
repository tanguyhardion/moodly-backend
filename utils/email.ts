import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`[DEBUG_EMAIL] Attempting to send email to: ${to} with subject: ${subject}`);
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[DEBUG_EMAIL] SMTP credentials not found. Email not sent.");
    return;
  }

  try {
    console.log(`[DEBUG_EMAIL] Using SMTP_USER: ${process.env.SMTP_USER}`);
    const info = await transporter.sendMail({
      from: `"Moodly" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log("[DEBUG_EMAIL] Message sent successfully: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("[DEBUG_EMAIL] Error sending email:", error);
    throw error;
  }
}
