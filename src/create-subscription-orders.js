import fetch from 'isomorphic-fetch'
import pMap from 'p-map'
import parser from 'cron-parser'
import { serializeError } from 'serialize-error'
import { getSubscriptionConfig } from './config.js'
import { updateOrderWithRetry } from './utils/utils.js'
import {
  ACTIVE_STATE,
  ERROR_STATE,
  REMINDER_SENT_STATE,
  SEND_REMINDER_STATE,
} from './states-constants.js'

let apiRoot
let ctpClient
let logger
let stats

async function createSubscriptionOrders({
  apiRoot: _apiRoot,
  ctpClient: _ctpClient,
  logger: _logger,
  stateKeyToIdMap,
}) {
  stats = {
    processedTemplateOrders: 0,
    subscriptionOrderAlreadyCreated: 0,
    successUrlCalls: 0,
    recoverableErrorUrlCalls: 0,
    unrecoverableErrorUrlCalls: 0,
    skippedTemplateOrders: 0,
  }
  apiRoot = _apiRoot
  ctpClient = _ctpClient
  logger = _logger
  const stateIds = [
    stateKeyToIdMap.get(ACTIVE_STATE),
    stateKeyToIdMap.get(SEND_REMINDER_STATE),
    stateKeyToIdMap.get(REMINDER_SENT_STATE),
  ]
  const config = getSubscriptionConfig()
  const headers = _buildHeaders(config)
  const subscriptionOrderCreationUrl = config.subscriptionOrderCreationUrl
  const orderQuery =
    await _buildQueryForTemplateOrdersToCreateSubscriptionOrders(stateIds)

  // eslint-disable-next-line no-loop-func
  for await (const templateOrders of ctpClient.fetchPagesGraphQl(orderQuery))
    await pMap(
      templateOrders,
      // eslint-disable-next-line no-loop-func
      async (templateOrder) => {
        try {
          await _processTemplateOrder(
            templateOrder,
            subscriptionOrderCreationUrl,
            headers
          )
        } catch (err) {
          stats.skippedTemplateOrders++
          logger.error(
            'Failed to process template order. This template order will be skipped. ' +
              'Processing will be restarted on the next run. ' +
              `Order details: ${JSON.stringify(templateOrder)}` +
              `Error: ${JSON.stringify(serializeError(err))}`
          )
        }
      },
      { concurrency: 3 }
    )

  return stats
}

async function _processTemplateOrder(
  {
    id,
    version,
    orderNumber,
    custom: { customFieldsRaw },
    state: { key: stateKey },
  },
  subscriptionOrderCreationUrl,
  headers
) {
  const deliveryDate = customFieldsRaw.find(
    (attr) => attr.name === 'nextDeliveryDate'
  ).value
  const doesSubscriptionOrderExists =
    await _fetchOrderBySubscriptionTemplateOrderRefAndDeliveryDate(
      id,
      deliveryDate
    )

  if (doesSubscriptionOrderExists) {
    logger.info(
      `Template order ${orderNumber}: ` +
        `Subscription order was already created for date ${deliveryDate}. Will update the template order only.`
    )
    stats.subscriptionOrderAlreadyCreated++
    await _updateTemplateOrder(id, version, customFieldsRaw, stateKey)
  } else {
    const response = await fetch(subscriptionOrderCreationUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ templateOrderId: id }),
    })
    if (_isError(response))
      if (_isErrorRecoverable(response)) {
        logger.error(
          `Template order ${orderNumber}: ` +
            `Recoverable error received when calling ${subscriptionOrderCreationUrl}. Will be retried next run. ` +
            `Response status code ${response.status}`
        )
        stats.recoverableErrorUrlCalls++
      } else {
        logger.error(
          `Template order ${orderNumber}: ` +
            `Unrecoverable error received when calling ${subscriptionOrderCreationUrl}. ` +
            'Please check the order and set its state back to "Active" ' +
            `Response status code ${response.status}`
        )
        await updateOrderWithRetry(
          apiRoot,
          id,
          [
            {
              action: 'transitionState',
              state: {
                typeId: 'state',
                key: ERROR_STATE,
              },
            },
          ],
          version
        )
        stats.unrecoverableErrorUrlCalls++
      }
    else {
      await _updateTemplateOrder(id, version, customFieldsRaw, stateKey)
      stats.successUrlCalls++
    }
  }
  stats.processedTemplateOrders++
}

async function _updateTemplateOrder(id, version, customFieldsRaw, stateKey) {
  const schedule = customFieldsRaw.find(
    (attr) => attr.name === 'schedule'
  ).value
  const cronExpression = parser.parseExpression(schedule)
  const nextDeliveryCronDate = cronExpression.next()
  const nextDeliveryDate = nextDeliveryCronDate.toDate()
  const nextDeliveryDateISOString = nextDeliveryDate.toISOString()
  const updateActions = [
    {
      action: 'setCustomField',
      name: 'nextDeliveryDate',
      value: nextDeliveryDateISOString,
    },
  ]

  if (stateKey !== ACTIVE_STATE)
    updateActions.push({
      action: 'transitionState',
      state: {
        typeId: 'state',
        key: ACTIVE_STATE,
      },
    })

  const reminderDays = customFieldsRaw.find(
    (attr) => attr.name === 'reminderDays'
  )?.value
  if (reminderDays) {
    nextDeliveryCronDate.setDate(nextDeliveryCronDate.getDate() - reminderDays)
    const nextReminderDateISOString = nextDeliveryCronDate.toISOString()
    updateActions.push({
      action: 'setCustomField',
      name: 'nextReminderDate',
      value: nextReminderDateISOString,
    })
  }

  await updateOrderWithRetry(apiRoot, id, updateActions, version)
}

function _isError(response) {
  return response.status >= 400
}

function _isErrorRecoverable(response) {
  return (
    response.status > 500 ||
    response.status === 401 ||
    response.status === 403 ||
    response.status === 409
  )
}

async function _fetchOrderBySubscriptionTemplateOrderRefAndDeliveryDate(
  id,
  deliveryDate
) {
  const query = `
    query CheckExistingSubscriptionOrder($where: String) {
      orders(where: $where, limit: 1) {
        results {
          version
        }
      }
    }
  `
  const response = await ctpClient.queryGraphQl(query, {
    where: `custom(fields(subscriptionTemplateOrderRef(id="${id}") AND deliveryDate="${deliveryDate}"))`,
  })
  return response.body?.data?.orders?.results?.[0]
}

function _buildQueryForTemplateOrdersToCreateSubscriptionOrders(stateIds) {
  const now = new Date().toISOString()
  const where = `state(id in ("${stateIds.join(
    '","'
  )}")) AND custom(fields(nextDeliveryDate <= "${now}"))`

  return {
    queryBody: `
      query TemplateOrdersToCreateSubscriptionOrders($where: String, $limit: Int) {
        orders(where: $where, limit: $limit) {
          results {
            id
            version
            orderNumber
            custom {
              customFieldsRaw(includeNames: ["schedule", "reminderDays", "nextDeliveryDate"]) {
                name
                value
              }
            }
            state {
              key
            }
          }
        }
      }
      `,
    endpoint: 'orders',
    variables: {
      limit: 100,
      where,
    },
  }
}

function _buildHeaders(config) {
  const username = config.basicAuthUsername
  const password = config.basicAuthPassword
  let headers = config.customHeaders
  if (headers) headers = JSON.parse(headers)
  else headers = {}
  if (username && password)
    headers['Authorization'] = `Basic ${Buffer.from(
      `${username}:${password}`
    ).toString('base64')}`

  headers['Content-Type'] = 'application/json'
  return headers
}

export { createSubscriptionOrders }
