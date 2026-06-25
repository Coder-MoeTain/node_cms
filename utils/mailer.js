const fs = require('fs');
const path = require('path');
const appConfig = require('../config/app');

let transporter = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

async function getTransporter() {
  if (transporter) return transporter;
  if (!smtpConfigured()) return null;
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined
    });
    return transporter;
  } catch {
    return null;
  }
}

function logToFile(entry) {
  const dir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'email.log'), `${entry}\n`, 'utf8');
}

async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: 'missing_recipient' };

  const payload = {
    from: process.env.SMTP_FROM || `NodePress <noreply@${new URL(appConfig.url).hostname}>`,
    to,
    subject,
    text,
    html: html || text
  };

  const transport = await getTransporter();
  if (transport) {
    await transport.sendMail(payload);
    return { sent: true, mode: 'smtp' };
  }

  const line = `[${new Date().toISOString()}] To: ${to} | ${subject}\n${text || ''}`;
  if (appConfig.env === 'production') {
    console.warn('SMTP not configured; email not sent:', subject, '→', to);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  console.log(`[mailer] ${line}`);
  logToFile(line);
  return { sent: true, mode: 'log' };
}

async function sendPasswordResetEmail(user, token) {
  const resetUrl = `${appConfig.url}/admin/reset-password?token=${encodeURIComponent(token)}`;
  const subject = `${appConfig.name} — Password reset`;
  const text = `Reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`;
  return sendMail({ to: user.email, subject, text });
}

async function sendCommentNotification({ post, comment }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: false, reason: 'admin_email_not_set' };
  const subject = `New comment on "${post.title}"`;
  const text = `${comment.name} <${comment.email}> wrote:\n\n${comment.content}\n\nModerate: ${appConfig.url}/admin/comments`;
  return sendMail({ to: adminEmail, subject, text });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendCommentNotification,
  smtpConfigured
};
