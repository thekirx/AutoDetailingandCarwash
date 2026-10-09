import { isApprovalPreview } from './approvalPreview'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import defaults from '../data/tintFinderConfig.json'
import { validateTintConfig } from './tintFinder'

export function useTintFinderConfig() {
  const [config, setConfig] = useState(defaults)
  const [loading, setLoading] = useState(!isApprovalPreview)
  useEffect(() => {
    if (isApprovalPreview) return
    let active = true
    supabase.from('tint_finder_settings').select('config').eq('id',1).maybeSingle().then(({data})=>{
      if (active) {
        if (data?.config && !validateTintConfig(data.config)) setConfig(data.config)
        setLoading(false)
      }
    }).catch(()=>{if(active) setLoading(false)})
    return ()=>{active=false}
  },[])
  return {config,loading}
}
