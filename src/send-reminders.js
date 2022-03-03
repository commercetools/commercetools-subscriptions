import pMap from 'p-map'
import { getApiRoot, getCtpClient } from './utils/client.js'
import getLogger from './utils/logger.js'

const apiRoot = getApiRoot()
const ctpClient = getCtpClient()
const logger = getLogger()

const stats = {
  processedTemplateOrders: 0,
}

async function sendReminders() {
  const templateOrderTypeId = await findTemplateOrderTypeId()
  logger.log(templateOrderTypeId)
  const uri = await _buildFetchTemplateOrders()

  await ctpClient.fetchBatches(uri, async (templateOrders) => {
    stats.processedTemplateOrders += templateOrders.length
    await pMap(templateOrders, _processTemplateOrder, { concurrency: 3 })
  })
  return stats
}

async function findTemplateOrderTypeId() {
  try {
    const { body: { id } } = await apiRoot
      .types()
      .withKey({ key: 'subscription-template-order' })
      .get()
      .execute()
    return id
  } catch (e) {
    if (e.code === 404) return null // todo: log type is not exists
    throw e
  }
}

// async function findActiveStateId() {
//   let stateId
//   try {
//     const result = await apiRoot.states().withKey({ key: 'Active' }).get().execute()
//   } catch (e) {
//     if (e.code === 404) return null // todo: log state is not exists
//     throw e
//   }
// }

async function _buildFetchTemplateOrders() {
  const now = new Date().toISOString() // todo: local date or iso date ?
  const where = `state = Active AND custom(fields(nextReminderDate <= "${now}"))`
  return ctpClient.builder.orders.where(where)
}

async function _processTemplateOrder(templateOrder) {
  return templateOrder
}

export { sendReminders }
