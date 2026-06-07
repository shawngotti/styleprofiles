// Transactional email processor — drains email_outbox via Resend.
// Triggering it is harmless (it only sends already-queued, opted-in mail), so
// it's public (verify_jwt=false) and meant to be hit on a schedule (e.g. a cron
// every minute, or Supabase scheduled function). Fails safe (503) until
// RESEND_API_KEY is set. Retries up to MAX_ATTEMPTS, then marks 'failed'.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (e.g. "StyleProfiles <hi@yourdomain>"),
// optional APP_URL for the CTA link.

import { json, serviceClient } from '../_shared/util.ts'

const KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('EMAIL_FROM') ?? 'StyleProfiles <noreply@styleprofiles.app>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://styleprofiles.app'
const MAX_ATTEMPTS = 4
const BATCH = 25

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

function renderHtml(row: { subject: string; body: string }) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;color:#f5f5f5">
    <div style="font-size:20px;font-weight:700;margin-bottom:24px">Style<span style="color:#F4A93C">Profiles</span></div>
    <div style="background:#141417;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px">
      <h1 style="font-size:17px;margin:0 0 12px">${esc(row.subject)}</h1>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 20px">${esc(row.body)}</p>
      <a href="${esc(APP_URL)}" style="display:inline-block;background:#F4A93C;color:#000;font-weight:600;font-size:14px;text-decoration:none;padding:10px 18px;border-radius:10px">Open StyleProfiles</a>
    </div>
    <p style="font-size:12px;color:#6b6b6b;margin-top:20px">You're receiving this because you have email notifications on. Manage them in your account settings.</p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method not allowed' }, 405)
  if (!KEY) return json({ error: 'RESEND_API_KEY not configured', processed: 0 }, 503)

  const svc = serviceClient()
  const { data: rows } = await svc
    .from('email_outbox')
    .select('id,to_email,subject,body,attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH)

  let sent = 0
  let failed = 0
  for (const r of rows ?? []) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: r.to_email, subject: r.subject, html: renderHtml(r) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || `resend ${res.status}`)
      await svc.from('email_outbox').update({ status: 'sent', provider_id: data.id, sent_at: new Date().toISOString() }).eq('id', r.id)
      sent++
    } catch (e) {
      const attempts = r.attempts + 1
      await svc
        .from('email_outbox')
        .update({ attempts, error: String((e as Error).message).slice(0, 500), status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' })
        .eq('id', r.id)
      failed++
    }
  }

  return json({ processed: rows?.length ?? 0, sent, failed })
})
