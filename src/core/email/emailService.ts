import nodemailer from 'nodemailer';

require('dotenv').config();

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  const fromName = process.env.EMAIL_FROM_NAME || 'Avera';
  const fromUser = process.env.EMAIL_USER || 'no-reply@averatech.com.br';

  await transporter.sendMail({
    from: `"${fromName}" <${fromUser}>`,
    to,
    subject,
    html,
  });
};