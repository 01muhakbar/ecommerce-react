import nodemailer from 'nodemailer';

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendEmail = async (options: EmailOptions) => {
  // 1) Buat transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2) Definisikan opsi email
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Your App Name <your_email@example.com>',
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // 3) Kirim email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;