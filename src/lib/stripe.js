import { loadStripe } from '@stripe/stripe-js'

// Publishable key is safe in the browser. Deposits are destination charges on
// the platform account, so the client confirms with the platform key.
const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
export const stripePromise = key ? loadStripe(key) : Promise.resolve(null)
