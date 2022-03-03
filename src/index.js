import getLogger from './utils/logger.js'
import { getPackageJson } from './config.js'
import { run } from './runner.js'

const packageJson = await getPackageJson()

const logger = getLogger()
logger.info(`${packageJson.name} started`)

try {
  await run()
} catch (e) {
  logger.error(
    e,
    `Error while executing ${packageJson.name}. Process terminated.`
  )
  process.exitCode = 1
}
