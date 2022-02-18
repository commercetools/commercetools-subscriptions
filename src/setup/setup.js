import { ensureCustomTypes } from './ensure-custom-types.js'
import { ensureStates } from './ensure-states.js'
import getApiRoot from '../utils/client.js'
import getLogger from '../utils/logger.js'

export default async function setupSubscriptionResources() {
  const apiRoot = getApiRoot()
  const mainLogger = getLogger()
  await ensureCustomTypes(apiRoot, mainLogger)
  await ensureStates(apiRoot, mainLogger)
}

await setupSubscriptionResources()
