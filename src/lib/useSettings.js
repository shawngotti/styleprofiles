import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

// Reads platform_settings (feature flags) once on mount. Drives which tabs/
// screens appear. The flags ALSO gate the API + RLS server-side, so this hook is
// purely a UX convenience — hiding a tab here is not what makes a feature safe.
export function useSettings() {
  const [flags, setFlags] = useState(null) // null = loading

  useEffect(() => {
    let active = true
    supabase
      .from('platform_settings')
      .select('key,value')
      .then(({ data }) => {
        if (!active) return
        setFlags(Object.fromEntries((data || []).map((r) => [r.key, r.value === true])))
      })
    return () => {
      active = false
    }
  }, [])

  return {
    loading: flags === null,
    marketplaceOn: !!flags?.marketplace_on,
    lineupOn: !!flags?.lineup_on,
    awardsOn: flags?.awards_on !== false, // default-on
  }
}
