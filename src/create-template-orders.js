import getApiRoot from './utils/client.js'

const apiRoot = getApiRoot()

async function _fetchLastStartTimestamp() {
  try {
    return (
      await apiRoot
        .customObjects()
        .withContainerAndKey({
          container: 'commercetools-subscriptions',
          key: 'lastStartTimestamp',
        })
        .get()
        .execute()
    ).body
  } catch (e) {
    if (e.code === 404) return null
    throw e
  }
}

async function fetchCheckoutOrders() {
  let where =
    'custom(fields(hasSubscription=true)) AND custom(fields(isSubscriptionProcessed is not defined))'
  const lastStartTimestamp = await _fetchLastStartTimestamp()
  if (lastStartTimestamp)
    where = `createdAt > ${lastStartTimestamp} AND ${where}`
  const {
    body: { results },
  } = await apiRoot.orders().get({ queryArgs: { where } }).execute()
  return results
}

async function createTemplateOrders() {
  const unprocessedCheckoutOrders = await fetchCheckoutOrders()
}

export { createTemplateOrders }
