import { ensureStates } from './ensure-states.js'
import { getApiRoot } from '../utils/client.js'
import getLogger from '../utils/logger.js'

export default async function setupSubscriptionStates() {
  const apiRoot = getApiRoot()
  const mainLogger = getLogger()
  await ensureStates(apiRoot, mainLogger)
}

await setupSubscriptionStates()
