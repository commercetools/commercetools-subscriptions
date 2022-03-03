import pMap from 'p-map'
import VError from 'verror'
import { getApiRoot, getCtpClient } from './utils/client.js'

const apiRoot = getApiRoot()
const ctpClient = getCtpClient()

const stats = {
  processedTemplateOrders: 0,
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
  const where = `state(id="${activeStateId}") AND custom(fields(nextReminderDate >= "${now}"))`
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
  const maxRetry = 20
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
        // todo: check latest state and other fields and decide if retry is needed.
        // const templateOrder = fetchTemplateOrder(id)
        const currentVersion = err.body.errors[0].currentVersion
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

// async function fetchTemplateOrder(id) {
//   try {
//     return (
//         await apiRoot
//             .orders()
//             .withId({
//               ID: id
//             })
//             .get()
//             .execute()
//     ).body
//   } catch (e) {
//     if (e.code === 404) return null
//     throw e
//   }
// }

export { sendReminders }
