import nodemailer from "nodemailer";

interface EmailOptions {
  email: string;
  subject: string;
  text?: string;
  html?: string;
}

const sendEmail = async (options: EmailOptions) => {
  // 1. Buat transporter menggunakan kredensial SMTP dari .env
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10), // Add parseInt and default for port
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2. Definisikan opsi email
  const mailOptions = {
    from: process.env.EMAIL_FROM,
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
