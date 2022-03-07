import pMap from 'p-map'
import VError from 'verror'
import { serializeError } from 'serialize-error'

let apiRoot
let ctpClient
let logger
let stats
let activeStateId

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

    await _setActiveStateId()

    const orderQuery =
      await _buildQueryOfTemplateOrdersThatIsReadyToSendReminder(activeStateId)

    for await (const templateOrders of ctpClient.fetchPagesGraphQl(orderQuery))
      await pMap(templateOrders, _processTemplateOrder, { concurrency: 3 })

    return stats
  } catch (err) {
    logger.error(
      'Failed on send reminders, processing should be restarted on the next run.' +
        `Error: ${JSON.stringify(serializeError(err))}`
    )
    return stats
  }
}

async function _setActiveStateId() {
  const {
    body: { id },
  } = await apiRoot.states().withKey({ key: 'Active' }).get().execute()
  activeStateId = id
}

async function _buildQueryOfTemplateOrdersThatIsReadyToSendReminder() {
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

const updateActions = [
  {
    action: 'transitionState',
    state: {
      typeId: 'state',
      key: 'SendReminder',
    },
  },
]

async function _processTemplateOrder({ id, orderNumber, version }) {
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
            actions: updateActions,
            version,
          },
        })
        .execute()
      stats.updatedTemplateOrders++
      break
    } catch (err) {
      if (err.statusCode === 409) {
        retryCount += 1
        const currentVersion = await _fetchCurrentVersionOnRetry(id)
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
            `${retryMessage} Won't retry again` +
              ` because of a reached limit ${maxRetry}` +
              ' max retries.'
          )
        }
        version = currentVersion
      } else throw err
    }
}

async function _fetchCurrentVersionOnRetry(id) {
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
