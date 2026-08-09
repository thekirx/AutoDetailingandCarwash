const FALLBACK_BRANCHES = [
  { slug: 'bacoor', name: 'Bacoor', address: 'RFC Mall, Cavite', href: '/branches' },
  { slug: 'batangas', name: 'Batangas', address: 'Batangas City', href: '/branches' },
]

const COMING_SOON_BRANCH = {
  slug: 'dasmarinas-coming-soon',
  name: 'Dasmariñas',
  address: 'Dasmariñas, Cavite',
  href: null,
  isComingSoon: true,
  status: 'Coming Soon',
}

function activeCard(branch) {
  return {
    slug: branch.slug,
    name: branch.name.replace('Hakum Auto Care ', ''),
    address: branch.address || branch.slug,
    href: branch.href || `/queue/${branch.slug}`,
    isComingSoon: false,
    status: 'Active',
  }
}

export function buildHomeBranchCards(branches = []) {
  const activeBranches = branches.length ? branches : FALLBACK_BRANCHES
  return [...activeBranches.map(activeCard), COMING_SOON_BRANCH]
}

export function countActiveHomeBranches(cards = []) {
  return cards.filter((card) => !card.isComingSoon).length
}
