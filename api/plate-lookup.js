import { handlePublicPlateLookup } from '../server/publicPlateLookup.mjs'

export default async function handler(req, res) {
  return handlePublicPlateLookup(req, res)
}
