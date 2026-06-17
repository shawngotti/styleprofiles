// Renders the canonical legal markdown (docs/legal/*.md) into styled, standalone
// HTML in public/legal/ so the app can link to readable Terms/Privacy pages.
// Run LOCALLY via `npm run gen:legal` after editing docs/legal/*.md, then commit
// the generated public/legal/*.html. (Not part of `npm run build` — scripts/ and
// docs/ are excluded from the Vercel upload via .vercelignore, so the committed
// HTML in public/ is what ships.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) =>
  esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

function mdToHtml(md) {
  const out = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { closeList(); continue }
    if (line.startsWith('## ')) { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue }
    if (line.startsWith('# ')) { closeList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue }
    // Drop internal dev notes (e.g. the version ↔ platform_settings reminder).
    if (line.startsWith('> ')) {
      if (/platform_settings/.test(line)) continue
      closeList(); out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue
    }
    if (line.startsWith('- ')) { if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(line.slice(2))}</li>`); continue }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('\n')
}

const shell = (title, bodyHtml) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — StyleProfiles</title>
<style>
  :root { --gold:#F4A93C; }
  body { margin:0; background:#fff; color:#15110e; font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; line-height:1.6; }
  main { max-width:760px; margin:0 auto; padding:48px 22px 80px; }
  h1 { font-size:1.7rem; }
  h2 { font-size:1.15rem; margin-top:2rem; }
  a { color:var(--gold); }
  code { background:rgba(0,0,0,.06); padding:1px 5px; border-radius:4px; font-size:.9em; }
  blockquote { margin:1rem 0; padding:.5rem 1rem; border-left:3px solid var(--gold); background:rgba(0,0,0,.03); }
  ul { padding-left:1.2rem; }
  li { margin:.25rem 0; }
  .back { display:inline-block; margin-bottom:1.5rem; font-size:.9rem; }
</style>
</head>
<body>
<main>
<a class="back" href="/">← Back to StyleProfiles</a>
${bodyHtml}
</main>
</body>
</html>
`

mkdirSync('public/legal', { recursive: true })
for (const [src, out, title] of [
  ['docs/legal/terms-of-service.md', 'public/legal/terms.html', 'Terms of Service'],
  ['docs/legal/privacy-policy.md', 'public/legal/privacy.html', 'Privacy Policy'],
]) {
  // Inter-doc links: the .md cross-link points at privacy-policy.md → privacy.html
  const md = readFileSync(src, 'utf8').replace('privacy-policy.md', 'privacy.html')
  writeFileSync(out, shell(title, mdToHtml(md)))
  console.log(`wrote ${out}`)
}
