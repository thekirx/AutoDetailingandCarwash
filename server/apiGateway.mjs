import { json, setCors } from './httpUtil.mjs'

export function readGatewayOperation(req) {
  const url = new URL(req?.url || '/', 'http://localhost')
  const values = url.searchParams.getAll('operation')
  return values.length === 1 && values[0] ? values[0] : null
}

export function createGateway(operationHandlers) {
  const handlers = Object.freeze({ ...operationHandlers })

  return async function gateway(req, res) {
    if (String(req?.method || '').toUpperCase() === 'OPTIONS') {
      setCors(res, 'GET, POST, PUT, PATCH, DELETE, OPTIONS', req)
      res.statusCode = 204
      res.end()
      return
    }

    const operation = readGatewayOperation(req)
    const handler =
      operation && Object.prototype.hasOwnProperty.call(handlers, operation)
        ? handlers[operation]
        : null

    if (!handler) return json(res, 404, { error: 'Not found' }, req)
    return handler(req, res)
  }
}
