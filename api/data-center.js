import { createGateway } from '../server/apiGateway.mjs'
import { handleDataCenterRequest } from '../server/dataCenter.mjs'

export const operations = Object.freeze({
  'data-center': handleDataCenterRequest,
})

export default createGateway(operations)
