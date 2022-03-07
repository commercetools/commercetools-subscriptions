import { createTemplateOrders } from './create-template-orders.js'
import getLogger from './utils/logger.js'
import { getPackageJson } from './config.js'
import { getApiRoot, getCtpClient } from './utils/client.js'

async function run() {
  const startDate = new Date()
  const packageJson = await getPackageJson()
  const logger = getLogger()
  logger.info(`${packageJson.name} started`)

  const apiRoot = getApiRoot()
  const ctpClient = getCtpClient()

  const stats = await createTemplateOrders({
    apiRoot,
    ctpClient,
    logger,
    startDate,
  })
  logger.info(
    `Creating template orders process finished: ${JSON.stringify(stats)}`
  )

  const endDate = new Date()
  const executionTimeInSeconds = Math.floor(
    Math.abs(endDate - startDate) / 1000
  )
  logger.info(
    `${packageJson.name} completed in ${executionTimeInSeconds} seconds`
  )
}

export { run }
