# StyleProfiles — Accessibility (WCAG 2.1 AA) Audit

Status: **first pass complete.** This is a living checklist — re-run before launch
with a screen reader (VoiceOver/NVDA) and `axe`/Lighthouse.

## Fixed in this pass

| Issue | WCAG | Fix |
|---|---|---|
| No visible keyboard focus | 2.4.7 | Global `:focus-visible` outline (gold) in `index.css` |
| No way to skip nav | 2.4.1 | "Skip to content" link in `App.jsx` → `#main-content` on the `<main>` |
| Clickable pro card not keyboard-operable | 2.1.1 | Discover card got `role="button"`, `tabIndex`, Enter/Space handler, `aria-label` |
| Motion with no reduce option | 2.3.3 | `prefers-reduced-motion` media query disables transitions |
| Errors not announced | 4.1.3 | `role="alert"` on LegalGate / error regions (extend to all message areas) |
| `lang` on document | 3.1.1 | already present (`<html lang="en">`) |
| Form inputs labelled | 3.3.2 | inputs use `<label>` wrappers (verified in Shop, CotW, SubmitAwardEntry) |

## Known gaps to close before launch

- **Color contrast:** `text-white/40` (~3.7:1 on the dark bg) fails AA (4.5:1) for
  body text — acceptable for large/secondary text only. Audit each use; bump to
  `text-white/55`+ where it's meaningful copy.
- **aria-live on all toasts:** only the gated/error regions are wired; give every
  success/error `msg` paragraph `role="status"`/`role="alert"`.
- **Images:** reveal/portfolio `<img>` have `alt` = pro name; confirm meaningful
  alt for all and `alt=""` for decorative.
- **Modals/checkout:** Stripe PaymentElement flows should trap focus and restore
  it on close.
- **Tab order & headings:** verify a logical heading hierarchy (one `<h1>` per
  view) and tab order with a screen reader.

## How to test

```
npx @axe-core/cli http://localhost:5173   # automated checks
# + manual: keyboard-only pass, VoiceOver/NVDA pass, 200% zoom, reduced-motion
```
