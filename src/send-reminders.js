import pMap from 'p-map'
import VError from 'verror'
import { ACTIVE_STATE, SEND_REMINDER_STATE } from './states-constants.js'

let apiRoot
let logger
let stats

async function sendReminders({
  apiRoot: _apiRoot,
  logger: _logger,
  activeStateId,
}) {
  stats = {
    processedTemplateOrders: 0,
    updatedTemplateOrders: 0,
    skippedTemplateOrders: 0,
  }

  try {
    apiRoot = _apiRoot
    logger = _logger

    const orderQuery =
      _buildQueryOfTemplateOrdersThatIsReadyToSendReminder(activeStateId)

    for await (const templateOrders of apiRoot.fetchPagesGraphQl(orderQuery))
      await pMap(
        templateOrders,
        (order) => _processTemplateOrder(activeStateId, order),
        { concurrency: 3 }
      )
  } catch (err) {
    logger.error(
      err,
      'Failed on send reminders, processing should be restarted on the next run.'
    )
  }

  return stats
}

function _buildQueryOfTemplateOrdersThatIsReadyToSendReminder(activeStateId) {
  return {
    queryBody: `query TemplateOrdersThatIsReadyToSendReminderOrdersQuery($limit: Int, $where: String) {
            orders (limit: $limit, where: $where) {
                results {
                    id
                    orderNumber
                    version
                }
            }
        }`,
    endpoint: 'orders',
    variables: {
      limit: 100,
      where: _buildWhereClauseForReadyToSendReminderOrders(activeStateId),
    },
  }
}

function _buildWhereClauseForReadyToSendReminderOrders(activeStateId) {
  const now = new Date().toISOString()
  return `state(id="${activeStateId}") AND custom(fields(nextReminderDate <= "${now}"))`
}

async function _processTemplateOrder(
  activeStateId,
  { id, orderNumber, version }
) {
  let retryCount = 0
  const maxRetry = 10
  stats.processedTemplateOrders++
  // eslint-disable-next-line no-constant-condition
  while (true)
    try {
      await apiRoot
        .orders()
        .withId({ ID: id })
        .post({
          body: {
            actions: [
              {
                action: 'transitionState',
                state: {
                  typeId: 'state',
                  key: SEND_REMINDER_STATE,
                },
              },
            ],
            version,
          },
        })
        .execute()
      stats.updatedTemplateOrders++
      break
    } catch (err) {
      if (err.statusCode === 409) {
        retryCount += 1
        const currentVersion = await _fetchCurrentVersionOnRetry(
          id,
          activeStateId
        )
        if (!currentVersion) {
          stats.skippedTemplateOrders++
          break
        }

        if (retryCount > maxRetry) {
          const retryMessage =
            `Got a concurrent modification error when updating state from (${ACTIVE_STATE} to ${SEND_REMINDER_STATE})` +
            ` of the template order with number "${orderNumber}".` +
            ` Version tried "${version}",` +
            ` currentVersion: "${currentVersion}".`
          throw new VError(
            err,
            `${retryMessage} Won't retry again since maximum retry limit of ${maxRetry} is reached.`
          )
        }
        version = currentVersion
      } else throw err
    }
}
/*
 * Ensures on retry (409) the order has matching the condition below:
 * state(id="${activeStateId}") AND custom(fields(nextReminderDate <= "${now}")
 * for retrying to set state to 'commercetools-subscriptions-sendReminder',
 * @param id order id
 * @param activeStateId state id with the key 'commercetools-subscriptions-active'
 * @returns {Promise<null|*>} Returns the latest version of the template order if matches the condition,
 *   otherwise returns null for the latest version.
 * @private
 */
async function _fetchCurrentVersionOnRetry(id, activeStateId) {
  const {
    body: {
      results: [templateOrder],
    },
  } = await apiRoot
    .orders()
    .get({
      queryArgs: {
        where: `id="${id}" AND ${_buildWhereClauseForReadyToSendReminderOrders(
          activeStateId
        )}`,
      },
    })
    .execute()

  return templateOrder?.version
}

export { sendReminders }
