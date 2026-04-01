import nodemailer from 'nodemailer';
import { resolveEmailRuntimeSettings } from './systemSettings.js';

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendEmail = async (options: EmailOptions) => {
  const config = await resolveEmailRuntimeSettings();
  const missing = [
    ["EMAIL_HOST / smtpHost", config.host],
    ["EMAIL_USER / smtpUser", config.user],
    ["EMAIL_PASS / smtpPassword", config.pass],
    ["EMAIL_FROM / smtpFromEmail", config.fromEmail],
  ]
    .filter(([, value]) => !String(value || '').trim())
    .map(([label]) => label);

  if (missing.length > 0) {
    throw new Error(`Email delivery is not configured: ${missing.join(", ")}`);
  }

  // 1) Buat transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  // 2) Definisikan opsi email
  const normalizedFrom = String(config.fromEmail || '').includes('<')
    ? config.fromEmail
    : config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail;
  const mailOptions = {
    from: normalizedFrom,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // 3) Kirim email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;
