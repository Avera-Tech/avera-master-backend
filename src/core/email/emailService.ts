import nodemailer from 'nodemailer';

require('dotenv').config();

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.hostinger.com',
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Avera" <noreply@avera.com.br>',
    to,
    subject,
    html,
  });
};