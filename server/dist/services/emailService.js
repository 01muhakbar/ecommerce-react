"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendEmail = async (options) => {
    // 1) Buat transporter
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
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
exports.default = sendEmail;
