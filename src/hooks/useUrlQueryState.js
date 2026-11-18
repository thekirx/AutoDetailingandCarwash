import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Local search state that follows URL `?q=` transitions (including clearing back to ''). */
export function useUrlQueryState() {
  const [searchParams] = useSearchParams()
  const urlQ = searchParams.get('q') || ''
  const [state, setState] = useState(() => ({ urlQ, value: urlQ }))
  const value = state.urlQ === urlQ ? state.value : urlQ

  const setValue = useCallback(
    (next) => {
      setState((prev) => {
        const cur = prev.urlQ === urlQ ? prev.value : urlQ
        const resolved = typeof next === 'function' ? next(cur) : next
        return { urlQ, value: resolved }
      })
    },
    [urlQ],
  )

  return [value, setValue]
}
