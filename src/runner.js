import { createTemplateOrders } from './create-template-orders.js'
import getLogger from './utils/logger.js'
import { getPackageJson } from './config.js'
import { getApiRoot, getCtpClient } from './utils/client.js'
import { sendReminders } from './send-reminders.js'
import { createSubscriptionOrders } from './create-subscription-orders.js'
import {
  ACTIVE_STATE,
  REMINDER_SENT_STATE,
  SEND_REMINDER_STATE,
} from './states-constants.js'

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

  const stateKeyToIdMap = await _fetchStateKeyToIdMap(apiRoot)
  const sendReminderStats = await sendReminders({
    apiRoot,
    ctpClient,
    logger,
    activeStateId: stateKeyToIdMap.get(ACTIVE_STATE),
  })
  logger.info(`Reminders are sent: ${JSON.stringify(sendReminderStats)}`)

  const createSubscriptionOrdersStats = await createSubscriptionOrders({
    apiRoot,
    ctpClient,
    logger,
    stateKeyToIdMap,
  })
  logger.info(
    `Create subscription orders finished: ${JSON.stringify(
      createSubscriptionOrdersStats
    )}`
  )

  const endDate = new Date()
  const executionTimeInSeconds = Math.floor(
    Math.abs(endDate - startDate) / 1000
  )
  logger.info(
    `${packageJson.name} completed in ${executionTimeInSeconds} seconds`
  )
}

async function _fetchStateKeyToIdMap(apiRoot) {
  const {
    body: { results },
  } = await apiRoot
    .states()
    .get({
      queryArgs: {
        where:
          // eslint-disable-next-line max-len
          `key in ("${ACTIVE_STATE}", "${SEND_REMINDER_STATE}", "${REMINDER_SENT_STATE}")`,
      },
    })
    .execute()
  return new Map(results.map((state) => [state.key, state.id]))
}

export { run }
