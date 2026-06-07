# StyleProfiles — Accessibility (WCAG 2.1 AA) Audit

Status: **AA code pass complete.** This is a living checklist — re-run before
launch with a screen reader (VoiceOver/NVDA) and `axe`/Lighthouse on real flows.

## Fixed

| Issue | WCAG | Fix |
|---|---|---|
| No visible keyboard focus | 2.4.7 | Global `:focus-visible` outline (gold) in `index.css` |
| No way to skip nav | 2.4.1 | "Skip to content" link in `App.jsx` → `#main-content` on the `<main>` |
| Clickable pro card not keyboard-operable | 2.1.1 | Discover card got `role="button"`, `tabIndex`, Enter/Space handler, `aria-label` |
| Motion with no reduce option | 2.3.3 | `prefers-reduced-motion` media query disables transitions |
| **Color contrast** | 1.4.3 | Eliminated `text-white/40` (~3.8:1 on the dark bg) → `text-white/55` (~6.2:1) app-wide. `/50`+ already pass; `border-white/40` focus rings (≥3:1 UI) left as-is. |
| **Errors/status not announced** | 4.1.3 | `role="alert"` on error regions + `role="status" aria-live="polite"` on status toasts across every screen (transactional + secondary). |
| Top-level heading | 1.3.1 / 2.4.6 | App header brand is now an `<h1>`; LoginScreen already had one. |
| `lang` on document | 3.1.1 | present (`<html lang="en">`) |
| Form inputs labelled | 3.3.2 | inputs use `<label>` wrappers + `aria-label` on icon/switch controls |
| Switches/radios | 4.1.2 | feature-flag/email/email toggles use `role="switch" aria-checked`; review stars use `role="radio"` |

## Remaining (verify with a real screen reader before launch)

- **Focus management on the Stripe PaymentElement views.** They're full-screen
  step replacements (not overlays over live content), so there's no background to
  trap — but confirm focus lands sensibly on entry and returns to the trigger on
  cancel. The notifications popover already closes on Escape/outside-click.
- **Images:** reveal/portfolio `<img>` use `alt` = pro name; confirm meaningful
  alt for all content images and `alt=""` for any decorative ones.
- **Full manual pass:** keyboard-only, VoiceOver/NVDA, 200% zoom, reduced-motion
  — plus `axe`/Lighthouse on authenticated flows (the automated tools below only
  see the login screen without a session).

## How to test

```
npx @axe-core/cli http://localhost:5173   # automated checks
# + manual: keyboard-only pass, VoiceOver/NVDA pass, 200% zoom, reduced-motion
```
