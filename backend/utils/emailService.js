/**
 * Email Notification Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends email alerts to the admin when:
 *   • A new customer starts a chat
 *   • A customer sends a message and no admin has responded yet
 *
 * Setup in .env:
 *   EMAIL_ENABLED=true
 *   EMAIL_HOST=smtp.gmail.com          (or your SMTP host)
 *   EMAIL_PORT=587
 *   EMAIL_USER=you@gmail.com
 *   EMAIL_PASS=your_app_password       (Gmail: use App Password, not account password)
 *   EMAIL_FROM=GCSC Support <you@gmail.com>
 *   EMAIL_TO=admin@yourcompany.com     (where to send alerts)
 *
 * For Gmail: enable 2FA → generate an App Password at myaccount.google.com/apppasswords
 * For other providers: use their SMTP credentials
 */

const nodemailer = require('nodemailer');

// Build transporter lazily (only if email is configured)
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.EMAIL_ENABLED !== 'true') return null;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Email] EMAIL_ENABLED=true but SMTP credentials missing — email disabled.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',  // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return _transporter;
}

/**
 * Send an email notification.
 * Silently swallows errors — email is non-critical.
 */
async function sendEmail({ subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) return;

  const to   = process.env.EMAIL_TO   || process.env.EMAIL_USER;
  const from = process.env.EMAIL_FROM || `GCSC Support Alerts <${process.env.EMAIL_USER}>`;

  try {
    await transporter.sendMail({ from, to, subject, html, text });
    console.log(`📧 [Email] Sent: "${subject}" → ${to}`);
  } catch (err) {
    console.error(`📧 [Email] Failed to send "${subject}":`, err.message);
  }
}

/**
 * Notify admin of a new chat session.
 */
async function notifyNewChat({ sessionId, customerName, customerEmail }) {
  const name  = customerName  || 'Guest';
  const email = customerEmail || '(no email)';
  const time  = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true });
  const link  = process.env.ADMIN_CHAT_URL || 'http://localhost:5500/frontend/admin/chat.html';

  await sendEmail({
    subject: `💬 New Live Chat — ${name}`,
    text: `New chat from ${name} (${email})\nStarted: ${time}\nSession: ${sessionId}\n\nReply at: ${link}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1A3A8A,#2E5DB3);padding:28px 32px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-.5px">
        Global<span style="color:#F47920">Cargo</span>
      </div>
      <div style="color:rgba(255,255,255,.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">
        Shipping Company
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <div style="background:#FFF3E8;border-left:4px solid #F47920;border-radius:6px;padding:12px 16px;margin-bottom:24px">
        <span style="font-size:18px">💬</span>
        <span style="font-weight:700;color:#1A3A8A;font-size:15px;margin-left:8px">New Live Chat Started</span>
      </div>

      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;width:110px">Customer</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;color:#111827">${name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#111827">${email}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px">Time</td>
          <td style="padding:10px 0;color:#111827">${time}</td>
        </tr>
      </table>

      <div style="margin-top:28px;text-align:center">
        <a href="${link}" style="display:inline-block;background:#1A3A8A;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:.3px">
          Open Chat Dashboard →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #f0f2f5">
      GCSC Admin Notification · Reply immediately to provide great support
    </div>
  </div>
</body>
</html>`,
  });
}

/**
 * Notify admin of a new message when chat has no active admin.
 */
async function notifyNewMessage({ sessionId, customerName, message }) {
  const name = customerName || 'Guest';
  const link = process.env.ADMIN_CHAT_URL || 'http://localhost:5500/frontend/admin/chat.html';

  await sendEmail({
    subject: `📩 New message from ${name}`,
    text: `${name} says: "${message}"\n\nSession: ${sessionId}\nReply at: ${link}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#1A3A8A,#2E5DB3);padding:24px 32px">
      <div style="font-size:22px;font-weight:800;color:#fff">Global<span style="color:#F47920">Cargo</span></div>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;color:#111827;font-size:15px"><strong>${name}</strong> sent a message:</p>
      <div style="background:#f0f4ff;border-left:3px solid #1A3A8A;padding:14px 18px;border-radius:6px;color:#1A3A8A;font-style:italic">"${message.slice(0, 200)}${message.length > 200 ? '…' : ''}"</div>
      <div style="margin-top:24px;text-align:center">
        <a href="${link}" style="display:inline-block;background:#1A3A8A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">Reply Now →</a>
      </div>
    </div>
  </div>
</body>
</html>`,
  });
}

module.exports = { notifyNewChat, notifyNewMessage };
