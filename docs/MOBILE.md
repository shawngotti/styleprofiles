# Shipping StyleProfiles to the App Store / Play Store

StyleProfiles is wrapped for mobile with **Capacitor** — the same React/Vite app
runs inside a thin native shell. No rewrite, one codebase for web + iOS + Android.

## What's already set up

- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` (deps) + `@capacitor/cli` (dev).
- `capacitor.config.ts` — appId `com.styleprofiles.app`, `webDir: dist`.
- npm scripts: `cap:sync`, `cap:ios`, `cap:android`.
- `/ios` and `/android` are gitignored — they're generated locally (large, machine-specific).

## One-time: generate the native projects

You need **Xcode** (for iOS) and/or **Android Studio** (for Android) installed.

```bash
npm run build              # produce dist/
npx cap add ios            # creates /ios  (needs Xcode + CocoaPods)
npx cap add android        # creates /android (needs Android Studio)
```

## Each time you change the web app

```bash
npm run cap:ios       # build + sync + open Xcode
# or
npm run cap:android   # build + sync + open Android Studio
```

Then Run/Archive from Xcode (→ App Store Connect) or Android Studio (→ Play Console).

## Before submitting — still to do

1. **App icons + splash** — add `@capacitor/assets` and drop a 1024×1024 icon:
   `npx @capacitor/assets generate`.
2. **Bundle identifier & signing** — set your Apple Team / Android keystore in the
   native projects.
3. **OAuth redirect** — Google sign-in needs the native redirect scheme registered
   (Supabase Auth → URL config) so the in-app browser returns to the app.
4. **Stripe** — the current web Stripe Elements work in the Capacitor webview; for a
   more native feel later, consider `@capacitor-community/stripe`. Note Apple's
   in-app-purchase rules apply to *digital* goods only — booking/marketplace
   payments for real-world services are fine through Stripe.
5. **Deep links / push** — optional: `@capacitor/push-notifications` for booking and
   review alerts.

## Why Capacitor (vs React Native)

The app is already built and shipping on the web. Capacitor reuses 100% of it and
keeps a single deploy. React Native would mean rewriting every screen.
