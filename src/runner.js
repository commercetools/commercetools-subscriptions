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

  const sendReminderStats = await sendReminders({ apiRoot, ctpClient, logger })
  logger.info(`Reminders are sent: ${JSON.stringify(sendReminderStats)}`)

  const endDate = new Date()
  const executionTimeInSeconds = Math.floor(
    Math.abs(endDate - startDate) / 1000
  )
  logger.info(
    `${packageJson.name} completed in ${executionTimeInSeconds} seconds`
  )
}

export { run }
