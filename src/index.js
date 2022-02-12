import getLogger from './utils/logger.js'
import { getPackageJson } from './config.js'
import getApiRoot from './utils/client.js'

const packageJson = await getPackageJson()
const apiRoot = getApiRoot()

const logger = getLogger()
logger.info(`${packageJson.name} started`)
const startDate = new Date()
try {
  const { body: { key } } = await apiRoot.get()
    .execute()

  const endDate = new Date()
  const executionTimeInSeconds = Math.floor(
    Math.abs(endDate - startDate) / 1000
  )
  logger.info(
    `${packageJson.name} completed in ${executionTimeInSeconds} seconds`
  )
} catch (e) {
  logger.error(
    e,
    `Error while executing ${packageJson.name}. Process terminated.`
  )
  process.exitCode = 1
}
