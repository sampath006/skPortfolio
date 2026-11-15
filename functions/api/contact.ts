import { z } from 'zod';
import { json, clientIp, sameOrigin, type Ctx } from '../../server/http';
import { prepare, allow } from '../../server/db';

const Message = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).optional(), // honeypot: real people never fill this in
  token: z.string().max(4000).optional(),
});

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!sameOrigin(request)) return json({ error: 'Send the form from the site itself.' }, 403);
  if (!env.DB && !(env.RESEND_API_KEY && env.CONTACT_TO)) return json({ error: 'Contact form is not set up yet.' }, 503);

  const parsed = Message.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Add your name, a valid email and a message of at least 10 characters.' }, 400);
  const { name, email, message, website, token } = parsed.data;
  if (website) return json({ ok: true }); // bot: pretend it worked, store nothing

  const ip = clientIp(request);
  if (!(await allow(env.DB, `contact:${ip}`, 5, 3600))) return json({ error: 'Too many messages. Try again in an hour.' }, 429);

  if (env.TURNSTILE_SECRET) {
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token || '', remoteip: ip }),
    });
    const result: any = await check.json().catch(() => ({}));
    if (!result.success) return json({ error: 'Tick the "I am human" check and send again.' }, 400);
  }

  let stored = false;
  if (env.DB) {
    await prepare(env.DB);
    await env.DB.prepare('INSERT INTO messages (name, email, message, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(name, email, message, new Date().toISOString())
      .run();
    stored = true;
  }

  let emailed = false;
  if (env.RESEND_API_KEY && env.CONTACT_TO) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Portfolio <onboarding@resend.dev>',
        to: [env.CONTACT_TO],
        reply_to: email,
        subject: `Portfolio message from ${name}`,
        text: `${message}\n\nFrom: ${name} <${email}>`,
      }),
    });
    emailed = res.ok;
  }

  if (!stored && !emailed) return json({ error: 'Message not sent. Try again later.' }, 502);
  return json({ ok: true });
};
