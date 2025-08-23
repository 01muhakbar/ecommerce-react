const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Buat transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Aktifkan di mode development jika ada masalah dengan sertifikat
    // tls: {
    //   rejectUnauthorized: false
    // }
  });

  // 2) Definisikan opsi email
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Your App Name <your_email@example.com>', // Ganti dengan email aplikasi Anda
    to: options.email,
    subject: options.subject,
    html: options.message,
    // text: options.message, // Anda juga bisa mengirim plain text
  };

  // 3) Kirim email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
