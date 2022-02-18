import bunyan from 'bunyan'
import { getLogLevel, getPackageJson } from '../config.js'

let logger
const packageJson = await getPackageJson()

export default function getLogger() {
  if (logger === undefined)
    logger = bunyan.createLogger({
      name: `${packageJson.name}-${packageJson.version}`,
      stream: process.stdout,
      level: getLogLevel(),
      serializers: bunyan.stdSerializers,
    })

  return logger
}
