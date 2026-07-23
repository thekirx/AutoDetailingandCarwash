import { handlePublicBookRequest } from '../server/publicBook.mjs'

export default async function handler(req, res) {
  await handlePublicBookRequest(req, res)
}
