import type { Env } from "../types";

interface ResendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

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
        from: "LoopSquad <digest@loop.freegameplay.site>",
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
