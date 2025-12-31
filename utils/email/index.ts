import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Moodly" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return info;
  } catch (error) {
    throw error;
  }
}
