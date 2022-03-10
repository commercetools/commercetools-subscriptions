import pMap from 'p-map'
import VError from 'verror'
import { serializeError } from 'serialize-error'

let apiRoot
let ctpClient
let logger
let stats

async function sendReminders({
  apiRoot: _apiRoot,
  ctpClient: _ctpClient,
  logger: _logger,
}) {
  stats = {
    processedTemplateOrders: 0,
    updatedTemplateOrders: 0,
    skippedTemplateOrders: 0,
  }

  try {
    apiRoot = _apiRoot
    ctpClient = _ctpClient
    logger = _logger

    const activeStateId = await _fetchActiveStateId()

    const orderQuery =
      await _buildQueryOfTemplateOrdersThatIsReadyToSendReminder(activeStateId)

    for await (const templateOrders of ctpClient.fetchPagesGraphQl(orderQuery))
      await pMap(
        templateOrders,
        (order) => _processTemplateOrder(activeStateId, order),
        { concurrency: 3 }
      )
  } catch (err) {
    logger.error(
      'Failed on send reminders, processing should be restarted on the next run.' +
        `Error: ${JSON.stringify(serializeError(err))}`
    )
  }

  return stats
}

async function _fetchActiveStateId() {
  const {
    body: { id },
  } = await apiRoot
    .states()
    .withKey({ key: 'commercetools-subscriptions-active' })
    .get()
    .execute()
  return id
}

async function _buildQueryOfTemplateOrdersThatIsReadyToSendReminder(
  activeStateId
) {
  const now = new Date().toISOString()
  const where = `state(id="${activeStateId}") AND custom(fields(nextReminderDate <= "${now}"))`
  return {
    queryBody: `query TemplateOrdersThatIsReadyToSendReminderOrdersQuery($limit: Int, $where: String) {
            orders (limit: $limit, where: $where) {
                results {
                    id
                    orderNumber
                    version
                }
            }
        }`,
    endpoint: 'orders',
    variables: {
      limit: 100,
      where,
    },
  }
}

async function _processTemplateOrder(
  activeStateId,
  { id, orderNumber, version }
) {
  let retryCount = 0
  const maxRetry = 10
  stats.processedTemplateOrders++
  // eslint-disable-next-line no-constant-condition
  while (true)
    try {
      await apiRoot
        .orders()
        .withId({ ID: id })
        .post({
          body: {
            actions: [
              {
                action: 'transitionState',
                state: {
                  typeId: 'state',
                  key: 'SendReminder',
                },
              },
            ],
            version,
          },
        })
        .execute()
      stats.updatedTemplateOrders++
      break
    } catch (err) {
      if (err.statusCode === 409) {
        retryCount += 1
        const currentVersion = await _fetchCurrentVersionOnRetry(
          id,
          activeStateId
        )
        if (!currentVersion) {
          stats.skippedTemplateOrders++
          break
        }

        if (retryCount > maxRetry) {
          const retryMessage =
            'Got a concurrent modification error when updating state from (Active to SendReminder)' +
            ` of the template order with number "${orderNumber}".` +
            ` Version tried "${version}",` +
            ` currentVersion: "${currentVersion}".`
          throw new VError(
            err,
            `${retryMessage} Won't retry again since maximum retry limit of ${maxRetry} is reached.`
          )
        }
        version = currentVersion
      } else throw err
    }
}
/*
 * Ensures on retry (409) the order has matching the condition below:
 * state(id="${activeStateId}") AND custom(fields(nextReminderDate <= "${now}")
 * for retrying to set state to 'sendReminder',
 * @param id order id
 * @param activeStateId state id with the key 'Active'
 * @returns {Promise<null|*>} Returns the latest version of the template order if matches the condition,
 *   otherwise returns null for the latest version.
 * @private
 */
async function _fetchCurrentVersionOnRetry(id, activeStateId) {
  const templateOrder = await _fetchTemplateOrder(id)
  if (templateOrder) {
    const stateId = templateOrder.state?.id
    if (stateId && stateId === activeStateId) {
      const nextReminderDate = templateOrder.custom?.fields?.nextReminderDate
      if (nextReminderDate) {
        const now = new Date().toISOString()
        if (nextReminderDate <= now) return templateOrder.version
      }
    }
  }
  return null
}

async function _fetchTemplateOrder(id) {
  try {
    return (
      await apiRoot
        .orders()
        .withId({
          ID: id,
        })
        .get()
        .execute()
    ).body
  } catch (e) {
    if (e.code === 404) return null
    throw e
  }
}

export { sendReminders }
