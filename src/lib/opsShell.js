/** Resolve ?tab= deep links against an allow-list; falls back to defaultTab. */
export function resolveOpsTab(tabParam, allowedIds, defaultTab) {
  const ids = Array.isArray(allowedIds) ? allowedIds : []
  if (tabParam && ids.includes(tabParam)) return tabParam
  return defaultTab && ids.includes(defaultTab) ? defaultTab : ids[0] || defaultTab
}

/** Build search params for tab navigation — default tab clears ?tab=. */
export function opsTabSearchParams(nextTab, defaultTab) {
  return nextTab === defaultTab ? {} : { tab: nextTab }
}
