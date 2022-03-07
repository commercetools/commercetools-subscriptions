import pMap from 'p-map'
import VError from 'verror'
import { getApiRoot, getCtpClient } from './utils/client.js'

const apiRoot = getApiRoot()
const ctpClient = getCtpClient()

const stats = {
  processedTemplateOrders: 0,
  skippedTemplateOrders: 0
}

let activeStateId

async function sendReminders() {
  await setActiveStateId()

  const orderQuery = await buildQueryOfTemplateOrdersThatIsReadyToSendReminder(
    activeStateId
  )
  for await (const templateOrders of ctpClient.fetchPagesGraphQl(orderQuery))
    await pMap(templateOrders, processTemplateOrder, { concurrency: 3 })
  return stats
}

async function setActiveStateId() {
  const {
    body: { id },
  } = await apiRoot.states().withKey({ key: 'Active' }).get().execute()
  activeStateId = id
}

async function buildQueryOfTemplateOrdersThatIsReadyToSendReminder() {
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

async function processTemplateOrder({ id, orderNumber, version }) {
  let retryCount = 0
  const maxRetry = 10
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
      break
    } catch (err) {
      if (err.statusCode === 409) {
        retryCount += 1
        const currentVersion = _fetchCurrentVersionOnRetry(id)
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

  stats.processedTemplateOrders++
}

async function _fetchCurrentVersionOnRetry(id) {
  const templateOrder = await _fetchTemplateOrder(id)
  if (templateOrder) {
    const stateId = templateOrder.state?.id
    if (stateId && stateId === activeStateId) {
      const nextReminderDate = templateOrder.custom?.fields?.nextReminderDate
      if (nextReminderDate) {
        const now = new Date().toISOString()
        if (nextReminderDate <= now)
          return templateOrder.version
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
              ID: id
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
