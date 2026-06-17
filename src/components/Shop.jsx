import { useCallback, useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabaseClient.js'
import { stripePromise } from '../lib/stripe.js'
import { centsToUsd as money } from '../lib/format.js'
import { track } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Self-care marketplace (first-party). Catalog is RLS-gated on marketplace_on,
// so this only renders meaningfully when the shop is open. Checkout is fully
// server-authoritative: create_order prices the cart and returns a platform
// PaymentIntent; confirm_order settles it.
export default function Shop({ demo = false }) {
  const [products, setProducts] = useState(undefined)
  const [cart, setCart] = useState({}) // product_id -> qty
  const [checkout, setCheckout] = useState(null) // { clientSecret, order_id, total }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('id,name,brand,price,blurb,category,inventory_qty,is_available')
      .eq('is_available', true)
      .order('name')
    setProducts(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const items = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ product: products?.find((p) => p.id === id), qty })).filter((x) => x.product),
    [cart, products],
  )
  const subtotal = items.reduce((s, x) => s + x.product.price * x.qty, 0)

  function setQty(id, qty, max) {
    setCart((c) => {
      const next = { ...c }
      const capped = Math.max(0, Math.min(qty, max ?? 99))
      if (capped <= 0) delete next[id]
      else next[id] = capped
      return next
    })
  }

  async function startCheckout() {
    setBusy(true)
    setMsg(null)
    const body = { cart: items.map((x) => ({ product_id: x.product.id, qty: x.qty })) }
    const { data, error } = await supabase.functions.invoke('create_order', { body })
    setBusy(false)
    if (error || !data?.clientSecret) {
      let text = 'Could not start checkout'
      try {
        const j = await error.context.json()
        if (j?.error) text = j.error
      } catch { /* keep generic */ }
      setMsg({ type: 'error', text })
      return
    }
    setCheckout({ clientSecret: data.clientSecret, order_id: data.order_id, total: data.total })
  }

  if (products === undefined) return <p className="text-sm text-black/50">Loading shop…</p>

  if (checkout) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: checkout.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: GOLD, colorBackground: '#ffffff' } } }}
      >
        <OrderPayment
          orderId={checkout.order_id}
          total={checkout.total}
          onDone={() => {
            track('order_placed', { order_id: checkout.order_id, total: checkout.total })
            setCheckout(null)
            setCart({})
            setMsg({ type: 'ok', text: 'Order placed — thank you!' })
            load()
          }}
          onCancel={() => setCheckout(null)}
        />
      </Elements>
    )
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Self-care shop</h2>
      {demo && (
        <div className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/60">
          👀 <strong>Demo preview</strong> — sample products to show the marketplace. Checkout is disabled until the shop launches.
        </div>
      )}
      {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} role="status" aria-live="polite">{msg.text}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((p) => {
          const qty = cart[p.id] || 0
          const out = p.inventory_qty === 0
          return (
            <div key={p.id} className="flex flex-col justify-between rounded-2xl border border-black/10 bg-black/5 p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="shrink-0 font-semibold" style={{ color: GOLD }}>{money(p.price)}</div>
                </div>
                {p.brand && <div className="text-xs text-black/55">{p.brand}</div>}
                {p.blurb && <p className="mt-1 text-sm text-black/60">{p.blurb}</p>}
              </div>
              <div className="mt-3">
                {out ? (
                  <span className="text-xs text-black/55">Out of stock</span>
                ) : qty > 0 ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQty(p.id, qty - 1, p.inventory_qty)} className="h-7 w-7 rounded-lg bg-black/10">−</button>
                    <span className="text-sm">{qty}</span>
                    <button onClick={() => setQty(p.id, qty + 1, p.inventory_qty)} className="h-7 w-7 rounded-lg bg-black/10">+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setQty(p.id, 1, p.inventory_qty)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black"
                    style={{ backgroundColor: GOLD }}
                  >
                    Add to cart
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {products.length === 0 && <p className="text-sm text-black/55">No products yet.</p>}
      </div>

      {items.length > 0 && (
        <div className="sticky bottom-4 rounded-2xl border border-black/10 bg-white p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-sm text-black/70">
              {items.reduce((n, x) => n + x.qty, 0)} item(s) · {money(subtotal)} + shipping
            </span>
            <button
              onClick={startCheckout}
              disabled={busy || demo}
              title={demo ? 'Checkout is disabled in the demo preview' : undefined}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              style={{ backgroundColor: GOLD }}
            >
              {demo ? 'Checkout (demo)' : busy ? 'Starting…' : 'Checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderPayment({ orderId, total, onDone, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function pay() {
    if (!stripe || !elements) return
    setBusy(true)
    setErr(null)
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) {
      setErr(error.message)
      setBusy(false)
      return
    }
    // Server re-checks with Stripe and settles (the webhook is authoritative too).
    await supabase.functions.invoke('confirm_order', { body: { order_id: orderId } })
    setBusy(false)
    onDone()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Checkout · {money(total)}</h2>
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button onClick={pay} disabled={busy || !stripe} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-60" style={{ backgroundColor: GOLD }}>
          {busy ? 'Processing…' : `Pay ${money(total)}`}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-black/15 px-4 py-2 text-sm text-black/70">Cancel</button>
      </div>
    </div>
  )
}
