import nodemailer from "nodemailer";
import { resolveEmailRuntimeSettings } from "../services/systemSettings.js";

interface EmailOptions {
  email: string;
  subject: string;
  text?: string;
  html?: string;
}

const sendEmail = async (options: EmailOptions) => {
  const config = await resolveEmailRuntimeSettings();
  const missing = [
    ["EMAIL_HOST / smtpHost", config.host],
    ["EMAIL_USER / smtpUser", config.user],
    ["EMAIL_PASS / smtpPassword", config.pass],
    ["EMAIL_FROM / smtpFromEmail", config.fromEmail],
  ]
    .filter(([, value]) => !String(value || "").trim())
    .map(([label]) => label);

  if (missing.length > 0) {
    throw new Error(`Email delivery is not configured: ${missing.join(", ")}`);
  }

  // 1. Buat transporter menggunakan kredensial SMTP dari .env
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  // 2. Definisikan opsi email
  const normalizedFrom = String(config.fromEmail || "").includes("<")
    ? config.fromEmail
    : config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail;
  const mailOptions = {
    from: normalizedFrom,
    to: options.email,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  // 3. Kirim email menggunakan transporter nodemailer
  await transporter.sendMail(mailOptions);

  console.log(
    `Email sent to ${options.email} with subject "${options.subject}"`
  );
};

export default sendEmail;
