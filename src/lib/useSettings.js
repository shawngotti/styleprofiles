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
        // Keep raw values (booleans stay booleans, URL strings stay strings).
        setFlags(Object.fromEntries((data || []).map((r) => [r.key, r.value])))
      })
    return () => {
      active = false
    }
  }, [])

  const marketplaceOn = !!flags?.marketplace_on
  const lineupOn = !!flags?.lineup_on
  const demoShopOn = !!flags?.demo_shop_on
  const demoLineupOn = !!flags?.demo_lineup_on
  return {
    loading: flags === null,
    marketplaceOn,
    lineupOn,
    awardsOn: flags?.awards_on !== false, // default-on
    demoShopOn,
    demoLineupOn,
    heroVideoUrl: flags?.home_hero_video_url || '',
    heroPosterUrl: flags?.home_hero_poster_url || '',
    // Effective visibility: a feature shows if it's launched OR demo'd. When only
    // the demo flag is on, the feature runs browse-only (real endpoints are off).
    shopVisible: marketplaceOn || demoShopOn,
    lineupVisible: lineupOn || demoLineupOn,
    shopDemoOnly: demoShopOn && !marketplaceOn,
    lineupDemoOnly: demoLineupOn && !lineupOn,
  }
}
