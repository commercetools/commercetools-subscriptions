import pino from 'pino'
import { getLogLevel, getPackageJson } from '../config.js'

let logger
const packageJson = await getPackageJson()

export default function getLogger() {
  if (logger) return logger
  logger = pino({
    name: `${packageJson.name}-${packageJson.version}`,
    level: getLogLevel(),
    depthLimit: 10, // default: 5
    redact: redactSensitiveInformationFromLogs(),
  })
  return logger
}

function redactSensitiveInformationFromLogs() {
  const fieldsToRedact = [
    // payment specific fields
    'customer',
    'transactions',
    'interfaceId',
    'interfaceInteractions',
    'paymentStatus',
    // order specific fields
    'customerId',
    'customerEmail',
    'customerGroup',
    'anonymousId',
    'shippingAddress',
    'billingAddress',
    'country',
    'paymentInfo',
    'shippingInfo',
    'itemShippingAddresses',
    'orderState',
    'shipmentState',
    'paymentState',
    'lineItems[*].shippingDetails',
    'customLineItems[*].shippingDetails',
  ]
  const paths = fieldsToRedact.reduce((values, field) => {
    const path = `originalRequest.body.${field}`
    return values.concat([`err.${path}`, `err.jse_cause.${path}`])
  }, [])

  return {
    paths,
    remove: true,
  }
}
