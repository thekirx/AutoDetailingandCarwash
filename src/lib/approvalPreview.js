/** Enabled only in the isolated, static client-approval build. */
export const isApprovalPreview = import.meta.env.VITE_TINT_APPROVAL_PREVIEW === 'true'
export const APPROVAL_BRANCHES = [
  { slug: 'bacoor', name: 'Bacoor', address: 'RFC Molino', is_active: true, is_public: true, coming_soon: false, hours: [] },
  { slug: 'batangas', name: 'Batangas', address: 'PNP Batangas', is_active: true, is_public: true, coming_soon: false, hours: [] },
]
