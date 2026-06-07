import { Component } from 'react'
import { reportError } from '../lib/analytics.js'

const GOLD = '#F4A93C'

// Catches render-time crashes so a single broken screen doesn't white-screen the
// app, and reports them (reportError is the single place to wire a monitoring
// SDK like Sentry later). Network/async errors are handled inline at call sites.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack })
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong.</h1>
          <p className="max-w-sm text-sm text-white/60">
            We hit an unexpected error and our team has been notified. Try reloading.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: GOLD, outlineColor: GOLD }}
          >
            Reload
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
