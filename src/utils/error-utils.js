import { serializeError } from 'serialize-error'

function filterAndSerializeError(err) {
  filterError(err)
  return JSON.stringify(serializeError(err))
}

function filterError(err) {
  delete err.originalRequest
  delete err.jse_cause?.originalRequest
}

export { filterAndSerializeError }
