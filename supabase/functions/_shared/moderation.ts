// Shared content screening for user-generated text + images.
// Uses OpenAI omni-moderation (text + image in one call) plus a local spam
// heuristic. Returns { flagged, labels, screenError }. A missing key or a
// provider error surfaces as screenError so callers can fail safe.

// Cheap local spam signal: links, emails, or phone numbers.
const SPAM = /(https?:\/\/|www\.|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b[\w.+-]+@[\w-]+\.[\w.-]+\b)/i

export async function screenContent(
  text: string | null,
  photoUrls: string[] = [],
): Promise<{ flagged: boolean; labels: string[]; screenError: boolean }> {
  const labels = new Set<string>()
  if (text && SPAM.test(text)) labels.add('spam')

  const key = Deno.env.get('OPENAI_API_KEY')
  // deno-lint-ignore no-explicit-any
  const input: any[] = []
  if (text) input.push({ type: 'text', text })
  for (const u of photoUrls.slice(0, 6)) input.push({ type: 'image_url', image_url: { url: u } })

  if (input.length === 0) return { flagged: labels.size > 0, labels: [...labels], screenError: false }
  if (!key) return { flagged: labels.size > 0, labels: [...labels], screenError: true }

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message || 'moderation request failed')
    for (const r of data.results || []) {
      if (r.flagged) {
        for (const [cat, on] of Object.entries(r.categories || {})) if (on) labels.add(cat)
      }
    }
    return { flagged: labels.size > 0, labels: [...labels], screenError: false }
  } catch (_e) {
    return { flagged: labels.size > 0, labels: [...labels], screenError: true }
  }
}
