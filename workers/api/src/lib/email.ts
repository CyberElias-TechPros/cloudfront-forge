import type { Env } from "../types";

interface ResendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optional override; defaults to the verified LoopSquad sender. */
  from?: string;
}

/**
 * Default sender. Resend requires a verified domain — point `EMAIL_FROM` at
 * your verified address (e.g. `LoopSquad <no@yourdomain.com>`) once the domain
 * is confirmed in the Resend dashboard; the fallback keeps local development
 * and first deploys working with the digest domain already in use.
 */
const DEFAULT_FROM = "LoopSquad <digest@loop.freegameplay.site>";

export async function sendEmail(env: Env, options: ResendEmailOptions): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from ?? env.EMAIL_FROM ?? DEFAULT_FROM,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Shared inline-styled shell. Transactional mail is read in one column on any
 * client, so the markup stays table-free and dependency-free.
 */
function shell(title: string, bodyBlocks: string, footer: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0f1020;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1020;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#191a33;border:1px solid #2b2c4d;border-radius:12px;">
          <tr><td style="padding:24px 28px 8px 28px;">
            <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#f5c451;font-weight:bold;">LoopSquad</p>
            <h1 style="margin:10px 0 0 0;font-size:20px;line-height:1.3;color:#f7f7fb;">${title}</h1>
          </td></tr>
          <tr><td style="padding:8px 28px 20px 28px;color:#c9c9dd;font-size:14px;line-height:1.6;">
            ${bodyBlocks}
          </td></tr>
          <tr><td style="padding:14px 28px 22px 28px;border-top:1px solid #2b2c4d;color:#7f7f9e;font-size:12px;line-height:1.5;">
            ${footer}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface NotificationEmailInput {
  title: string;
  intro: string;
  /**
   * App path (or absolute URL) for the call-to-action button. Relative paths
   * are resolved against `baseUrl` (the deployed SPA origin) because email
   * clients cannot resolve site-relative links; without a base URL the button
   * is dropped rather than shipped broken.
   */
  ctaUrl?: string;
  ctaLabel?: string;
  /** Origin of the deployed SPA, e.g. from the SITE_URL var. */
  baseUrl?: string;
}

/**
 * A notification re-sent by email. `ctaUrl` is rendered against the app when
 * given a path, so the button always lands on the in-app surface that owns the
 * event (top-ups, reviews, notifications…).
 */
export function renderNotificationEmail(input: NotificationEmailInput): string {
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const rawCta = input.ctaUrl;
  const absoluteCta = rawCta
    ? /^https?:\/\//i.test(rawCta)
      ? rawCta
      : input.baseUrl
        ? `${input.baseUrl.replace(/\/$/, "")}${rawCta.startsWith("/") ? rawCta : `/${rawCta}`}`
        : null
    : null;
  const cta = absoluteCta
    ? `<p style="margin:18px 0 0 0;"><a href="${escapeHtml(absoluteCta)}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px;font-size:14px;">${escapeHtml(input.ctaLabel ?? "Open LoopSquad")}</a></p>`
    : "";
  return shell(
    title,
    `<p style="margin:0;">${intro}</p>${cta}`,
    "You are receiving this because it concerns your LoopSquad account. Manage email, push and in-app preferences any time in Settings → Notifications.",
  );
}

export function renderWelcomeEmail(displayName: string | null, baseUrl?: string): string {
  const name = displayName ? escapeHtml(displayName) : "creator";
  const dashboardHref = baseUrl ? `${baseUrl.replace(/\/$/, "")}/dashboard` : null;
  return shell(
    `Welcome to LoopSquad, ${name}!`,
    `<p style="margin:0;">You have joined a squad of YouTube creators who watch, comment and give each other real feedback.</p>
     <p style="margin:12px 0 0 0;">Your first loop:</p>
     <ul style="margin:8px 0 0 18px;padding:0;color:#c9c9dd;font-size:14px;line-height:1.7;">
       <li>Join a community with an invite code (or find a public squad).</li>
       <li>Submit your video to the queue.</li>
       <li>Watch a squadmate's video, claim the reward, and leave a genuine comment.</li>
     </ul>
     ${dashboardHref ? `<p style="margin:18px 0 0 0;"><a href="${escapeHtml(dashboardHref)}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px;font-size:14px;">Enter the loop</a></p>` : ""}`,
    "Complete your profile, keep your streak alive, and check the dashboard for the next action.",
  );
}
