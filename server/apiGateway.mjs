import { json } from './httpUtil.mjs'

export function readGatewayOperation(req) {
  const url = new URL(req?.url || '/', 'http://localhost')
  const values = url.searchParams.getAll('operation')
  return values.length === 1 && values[0] ? values[0] : null
}

export function createGateway(operationHandlers) {
  const handlers = Object.freeze({ ...operationHandlers })

  return async function gateway(req, res) {
    const operation = readGatewayOperation(req)
    const handler =
      operation && Object.prototype.hasOwnProperty.call(handlers, operation)
        ? handlers[operation]
        : null

    if (!handler) return json(res, 404, { error: 'Not found' })
    return handler(req, res)
  }
}
