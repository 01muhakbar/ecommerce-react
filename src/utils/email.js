const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1. Buat transporter menggunakan kredensial SMTP dari .env
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
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

module.exports = sendEmail;
