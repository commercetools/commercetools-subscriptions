import { createTemplateOrders } from './create-template-orders.js'
import getLogger from './utils/logger.js'
import { getPackageJson } from './config.js'
import { getApiRoot, getCtpClient } from './utils/client.js'
import { sendReminders } from './send-reminders.js'

async function run() {
  const startDate = new Date()
  const packageJson = await getPackageJson()
  const logger = getLogger()
  logger.info(`${packageJson.name} started`)

  const apiRoot = getApiRoot()
  const ctpClient = getCtpClient()

  const createTemplateOrderStats = await createTemplateOrders({
    apiRoot,
    ctpClient,
    logger,
    startDate,
  })
  logger.info(
    `Creating template orders process finished: ${JSON.stringify(
      createTemplateOrderStats
    )}`
  )

  const activeStateId = await _fetchActiveStateId(apiRoot)
  const sendReminderStats = await sendReminders({
    apiRoot,
    ctpClient,
    logger,
    activeStateId,
  })
  logger.info(`Reminders are sent: ${JSON.stringify(sendReminderStats)}`)

  const endDate = new Date()
  const executionTimeInSeconds = Math.floor(
    Math.abs(endDate - startDate) / 1000
  )
  logger.info(
    `${packageJson.name} completed in ${executionTimeInSeconds} seconds`
  )
}

async function _fetchActiveStateId(apiRoot) {
  const {
    body: { id },
  } = await apiRoot
    .states()
    .withKey({ key: 'commercetools-subscriptions-active' })
    .get()
    .execute()
  return id
}

export { run }
