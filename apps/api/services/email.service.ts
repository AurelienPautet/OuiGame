// Transactional email via Resend's REST API. We call the HTTP endpoint directly
// with the built-in fetch (Node 24) rather than pulling in the `resend` SDK —
// one less dependency, and nothing to bundle. Email is OPTIONAL: when
// RESEND_API_KEY is unset (e.g. local dev, tests, or a misconfigured deploy) the
// helpers no-op with a warning instead of throwing, so the auth flow degrades
// gracefully rather than 500-ing.
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Must be an address on a domain verified in Resend. The default uses Resend's
// shared onboarding domain, which works out of the box for testing but should be
// overridden with a real "from" (e.g. "OuiTank <noreply@pautet.net>") in prod.
const EMAIL_FROM = process.env.EMAIL_FROM ?? "OuiTank <onboarding@resend.dev>";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Whether outbound email is configured. Callers can branch on this, but the
// senders below already no-op safely when it's false.
function isEmailConfigured() {
  return !!RESEND_API_KEY;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!RESEND_API_KEY) {
    console.warn(
      `RESEND_API_KEY is not set — skipping email "${subject}" to ${to}.`
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

// Escapes the few characters that could break out of an HTML attribute/text
// context. The username is the only user-controlled value interpolated into the
// template (the URL is a server-generated token), but we escape it defensively.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sends the password-reset email containing the one-time link. Resolves once the
// mail is accepted by Resend (or immediately, if email isn't configured).
async function sendPasswordResetEmail(
  to: string,
  username: string,
  resetUrl: string
) {
  const safeName = escapeHtml(username);
  const subject = "Reset your OuiTank password";
  const text =
    `Hi ${username},\n\n` +
    `We received a request to reset your OuiTank password.\n` +
    `Open this link to choose a new one (it expires in 1 hour):\n\n` +
    `${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email — your ` +
    `password won't change.\n\n— OuiTank`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f3f6;font-family:Arial,Helvetica,sans-serif;color:#1b1f24;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border:4px solid #1b1f24;border-radius:16px;overflow:hidden;max-width:440px;width:100%;">
            <tr>
              <td style="background:#16c8f5;border-bottom:4px solid #1b1f24;padding:20px 28px;">
                <span style="font-size:22px;font-weight:bold;color:#ffffff;">OuiTank</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:20px;">Reset your password</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
                  Hi ${safeName}, we received a request to reset your OuiTank password.
                  Click the button below to choose a new one.
                </p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${resetUrl}" style="display:inline-block;background:#16c8f5;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 24px;border:3px solid #1b1f24;border-radius:12px;">
                    Choose a new password
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5b6470;">
                  This link expires in 1 hour. If the button doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#16a6cc;">${resetUrl}</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6470;">
                  If you didn't request this, you can safely ignore this email — your password won't change.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendEmail({ to, subject, html, text });
}

export { isEmailConfigured, sendEmail, sendPasswordResetEmail };
