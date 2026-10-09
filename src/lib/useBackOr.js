import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/** Back to wherever the customer came from (Home or Me); straight to `fallback` when the screen was opened directly. */
export function useBackOr(fallback) {
  const navigate = useNavigate()
  return useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate(fallback)
  }, [navigate, fallback])
}
