const FALLBACK_BRANCHES = [
  { slug: 'bacoor', name: 'Bacoor', address: 'RFC Molino', href: '/branches' },
  { slug: 'batangas', name: 'Batangas', address: 'PNP Batangas', href: '/branches' },
]

const COMING_SOON_BRANCH = {
  slug: 'dasmarinas-coming-soon',
  name: 'Dasmariñas',
  address: 'Dasmariñas, Cavite',
  href: null,
  isComingSoon: true,
  status: 'Coming Soon',
}

export function publicBranchName(branch) {
  const name = String(branch.name || branch.slug || '')
    .replace(/^Hakum Auto Care\s*/i, '')
    .replace(/\s*Branch$/i, '')
    .trim()
  if (branch.slug === 'dasmarinas' || /^dasmari(?:n|ñ)as$/i.test(name)) return 'Dasmariñas'
  return name
}

function isComingSoonRow(row) {
  return Boolean(row?.coming_soon || row?.isComingSoon)
}

function activeCard(branch) {
  return {
    slug: branch.slug,
    name: publicBranchName(branch),
    address: branch.address || branch.slug,
    href: branch.href || `/queue/${branch.slug}`,
    isComingSoon: false,
    status: 'Active',
  }
}

function comingSoonCard(branch) {
  return {
    slug: branch.slug,
    name: publicBranchName(branch),
    address: branch.address || branch.slug,
    href: null,
    isComingSoon: true,
    status: 'Coming Soon',
  }
}

export function buildHomeBranchCards(branches = []) {
  if (!branches.length) {
    return [...FALLBACK_BRANCHES.map(activeCard), COMING_SOON_BRANCH]
  }
  const coming = branches.filter(isComingSoonRow).map(comingSoonCard)
  const active = branches.filter((row) => !isComingSoonRow(row)).map(activeCard)
  return [...active, ...coming]
}

export function countActiveHomeBranches(cards = []) {
  return cards.filter((card) => !card.isComingSoon).length
}

export function comingSoonHomeCopy(cards = []) {
  const names = cards.filter((card) => card.isComingSoon).map((card) => card.name).filter(Boolean)
  if (!names.length) return ''
  if (names.length === 1) return `with ${names[0]} coming soon`
  const last = names[names.length - 1]
  return `with ${names.slice(0, -1).join(', ')} and ${last} coming soon`
}
