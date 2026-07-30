import { handleDataCenterRequest } from '../server/dataCenter.mjs'

export default async function handler(req, res) {
  return handleDataCenterRequest(req, res)
}
