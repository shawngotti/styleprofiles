import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { listMembers, addMember, removeMember } from '../lib/household.js'

const GOLD = '#0FB9A6'
const TYPES = [
  { key: 'adult', label: 'Adult' },
  { key: 'child', label: 'Child' },
]

// Household manager: the primary holder adds/removes members (kids, partner)
// who can then be booked together under one deposit (the People step).
export default function HouseholdManager() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('adult')
  const [year, setYear] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(user.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addMember(user.id, {
        display_name: name.trim(),
        member_type: type,
        birth_year: year ? Number(year) : null,
      })
      setName('')
      setType('adult')
      setYear('')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    setError(null)
    try {
      await removeMember(id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <p className="text-sm text-black/50">Loading household…</p>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Household</h2>
        <p className="text-sm text-black/50">Add the people you book for. They can share one appointment and deposit.</p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="rounded-2xl border border-black/10 bg-black/5 p-2">
        <div className="flex items-center justify-between p-3">
          <span className="font-medium">You</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs" style={{ color: GOLD }}>
            primary
          </span>
        </div>
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-t border-black/5 p-3">
            <div>
              <div className="font-medium">{m.display_name}</div>
              <div className="text-xs text-black/50">
                {m.member_type}
                {m.birth_year ? ` · b. ${m.birth_year}` : ''}
              </div>
            </div>
            <button onClick={() => remove(m.id)} className="text-sm text-black/50 hover:text-red-600">
              Remove
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <p className="border-t border-black/5 p-3 text-sm text-black/55">No additional members yet.</p>
        )}
      </div>

      <form onSubmit={add} className="rounded-2xl border border-black/10 bg-black/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/55">Add a member</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="min-w-[140px] flex-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40"
          >
            {TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Birth year"
            inputMode="numeric"
            className="w-28 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/40"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            style={{ backgroundColor: GOLD }}
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  )
}
