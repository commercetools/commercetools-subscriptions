import getLogger from './utils/logger.js'
import { getPackageJson } from './config.js'
import { run } from './runner.js'

const packageJson = await getPackageJson()

const logger = getLogger()
logger.info(`${packageJson.name} started`)
const startDate = new Date()
try {
  await run()

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
