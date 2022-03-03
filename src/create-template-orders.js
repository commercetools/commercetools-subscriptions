import pMap from 'p-map'
import parser from 'cron-parser'
import _ from 'lodash'
import VError from 'verror'
import { serializeError } from 'serialize-error'

let apiRoot
let ctpClient
let logger
let stats

const LAST_START_TIMESTAMP_CUSTOM_OBJECT_CONTAINER =
  'commercetools-subscriptions'
const LAST_START_TIMESTAMP_CUSTOM_OBJECT_KEY =
  'subscriptions-lastStartTimestamp'

// to address all the write inconsistencies when writing to database
const INCONSISTENCY_MS = 3 * 60 * 1000

async function createTemplateOrders({
  apiRoot: _apiRoot,
  ctpClient: _ctpClient,
  logger: _logger,
  startDate,
}) {
  stats = {
    processedCheckoutOrders: 0,
    createdTemplateOrders: 0,
    failedCheckoutOrders: 0,
    duplicatedTemplateOrderCreation: 0,
  }

  try {
    apiRoot = _apiRoot
    ctpClient = _ctpClient
    logger = _logger

    const uri = await _buildFetchCheckoutOrdersUri()

    await ctpClient.fetchBatches(uri, async (orders) => {
      stats.processedCheckoutOrders += orders.length
      await pMap(orders, _processCheckoutOrder, { concurrency: 3 })
    })

    await _updateLastStartTimestamp(startDate)

    return stats
  } catch (err) {
    logger.error(
      'Failed to process checkout orders. lastStartTimestamp was not updated. ' +
        'Processing should be restarted on the next run.' +
        `Error: ${JSON.stringify(serializeError(err))}`
    )
    return stats
  }
}

async function _buildFetchCheckoutOrdersUri() {
  let where =
    'custom(fields(hasSubscription=true)) AND custom(fields(isSubscriptionProcessed is not defined))'
  const lastStartTimestampCustomObject = await _fetchLastStartTimestamp()
  if (lastStartTimestampCustomObject)
    where = `createdAt > "${lastStartTimestampCustomObject.value}" AND ${where}`

  const uri = ctpClient.builder.orders
    .where(where)
    .expand('paymentInfo.payments[*]')
  return uri
}

async function _processCheckoutOrder(checkoutOrder) {
  try {
    const templateOrderDrafts = _generateTemplateOrderDrafts(checkoutOrder)

    await pMap(
      templateOrderDrafts,
      async (templateOrderDraft) => {
        await _createTemplateOrderAndPayments(checkoutOrder, templateOrderDraft)
      },
      { concurrency: 3 }
    )

    await _setCheckoutOrderProcessed(checkoutOrder)
  } catch (err) {
    stats.failedCheckoutOrders++
    let cause = err
    if (err instanceof VError) cause = err.cause()
    if (cause.code === 409 || cause.code >= 500) throw err
    else
      logger.error(
        `Failed to create template order from the checkout order with number ${checkoutOrder.orderNumber}. ` +
          'Skipping this checkout order' +
          ` Error: ${JSON.stringify(serializeError(err))}`
      )
  }
}

async function _updateLastStartTimestamp(startDate) {
  const lastStartTimestamp = new Date(startDate.getTime() - INCONSISTENCY_MS)
  await apiRoot
    .customObjects()
    .post({
      body: {
        container: LAST_START_TIMESTAMP_CUSTOM_OBJECT_CONTAINER,
        key: LAST_START_TIMESTAMP_CUSTOM_OBJECT_KEY,
        value: lastStartTimestamp.toISOString(),
      },
    })
    .execute()
}

async function _fetchLastStartTimestamp() {
  try {
    return (
      await apiRoot
        .customObjects()
        .withContainerAndKey({
          container: LAST_START_TIMESTAMP_CUSTOM_OBJECT_CONTAINER,
          key: LAST_START_TIMESTAMP_CUSTOM_OBJECT_KEY,
        })
        .get()
        .execute()
    ).body?.results?.[0]
  } catch (e) {
    if (e.code === 404) return null
    throw e
  }
}

async function _updatePaymentAndStateWithRetry(
  templateOrder,
  updateActions,
  version = templateOrder.version
) {
  let retryCount = 0
  const maxRetry = 20
  while (true)
    try {
      await apiRoot
        .orders()
        .withId({ ID: templateOrder.id })
        .post({
          body: {
            actions: updateActions,
            version,
          },
        })
        .execute()
      break
    } catch (err) {
      if (err.statusCode === 409) {
        retryCount += 1
        const currentVersion = err.body.errors[0].currentVersion
        if (retryCount > maxRetry) {
          const retryMessage =
            'Got a concurrent modification error' +
            ` when updating template order with number "${templateOrder.orderNumber}".` +
            ` Version tried "${version}",` +
            ` currentVersion: "${currentVersion}".`
          throw new VError(
            err,
            `${retryMessage} Won't retry again` +
              ` because of a reached limit ${maxRetry}` +
              ' max retries.'
          )
        }
        version = currentVersion
      } else throw err
    }
}

async function _createTemplateOrderAndPayments(checkoutOrder, orderDraft) {
  try {
    const checkoutPayments = checkoutOrder.paymentInfo?.payments?.map(
      (p) => p.obj
    )
    let updateActions
    if (checkoutPayments) {
      const paymentDrafts = checkoutPayments.map(_createPaymentDraft)
      const paymentCreateResponses = await Promise.all(
        paymentDrafts.map((paymentDraft) =>
          apiRoot.payments().post({ body: paymentDraft }).execute()
        )
      )
      updateActions = paymentCreateResponses.map((paymentCreateResponse) => ({
        action: 'addPayment',
        payment: {
          type: 'payment',
          id: paymentCreateResponse.body.id,
        },
      }))
    }
    const { body: templateOrder } = await apiRoot
      .orders()
      .importOrder()
      .post({ body: orderDraft })
      .execute()
    stats.createdTemplateOrders++

    updateActions.push({
      action: 'transitionState',
      state: {
        typeId: 'state',
        key: 'Active',
      },
    })

    await _updatePaymentAndStateWithRetry(templateOrder, updateActions)
  } catch (err) {
    if (!_isDuplicateOrderError(err)) {
      const errMsg =
        `Unexpected error on creating template order from checkout order with number: ${checkoutOrder.orderNumber}.` +
        ` Line item: ${JSON.stringify(orderDraft.lineItems)}`
      throw new VError(err, errMsg)
    }
    stats.duplicatedTemplateOrderCreation++
  }
}

async function _setCheckoutOrderProcessed(checkoutOrder) {
  const updateActions = [
    {
      action: 'setCustomField',
      name: 'isSubscriptionProcessed',
      value: true,
    },
  ]
  await apiRoot
    .orders()
    .withId({ ID: checkoutOrder.id })
    .post({
      body: {
        actions: updateActions,
        version: checkoutOrder.version,
      },
    })
    .execute()
}

function _isDuplicateOrderError(e) {
  return (
    e.code === 400 &&
    e.body?.errors?.length === 1 &&
    e.body?.errors?.some(
      (err) => err.code === 'DuplicateField' && err.field === 'orderNumber'
    )
  )
}

function _generateTemplateOrderDrafts(checkoutOrder) {
  const orderDrafts = []
  const subscriptionLineItems = checkoutOrder.lineItems.filter(
    (lineItem) => lineItem.custom?.fields?.isSubscription
  )
  for (const lineItem of subscriptionLineItems)
    if (lineItem.quantity > 1)
      for (let i = 0; i < lineItem.quantity; i++) {
        const templateOrderDraft = _generateTemplateOrderImportDraft(
          checkoutOrder,
          lineItem,
          i + 1
        )
        orderDrafts.push(templateOrderDraft)
      }
    else {
      const templateOrderDraft = _generateTemplateOrderImportDraft(
        checkoutOrder,
        lineItem
      )
      orderDrafts.push(templateOrderDraft)
    }

  return orderDrafts
}

function _generateTemplateOrderImportDraft(
  checkoutOrder,
  lineItem,
  quantityIncrement
) {
  const schedule = lineItem.custom.fields.schedule
  const cronExpression = parser.parseExpression(schedule)
  let nextDeliveryCronDate = cronExpression.next()
  const nextDeliveryDate = nextDeliveryCronDate.toDate()
  let nextDeliveryDateISOString = nextDeliveryDate.toISOString()
  const cutoffDays = lineItem.custom.fields.cutoffDays
  if (cutoffDays) {
    nextDeliveryDate.setDate(nextDeliveryDate.getDate() - cutoffDays)
    if (nextDeliveryDate.toISOString() < checkoutOrder.createdAt) {
      nextDeliveryDateISOString = nextDeliveryDate.toISOString()
      nextDeliveryCronDate = cronExpression.next()
    }
  }
  const reminderDays = lineItem.custom.fields.reminderDays
  let nextReminderDateISOString
  if (reminderDays) {
    nextDeliveryCronDate.setDate(nextDeliveryCronDate.getDate() - reminderDays)
    nextReminderDateISOString = nextDeliveryCronDate.toISOString()
  }
  const templateOrder = {
    orderNumber:
      lineItem.custom.fields.subscriptionKey +
      (quantityIncrement ? `-${quantityIncrement}` : ''),
    customerId: checkoutOrder.customerId,
    store: checkoutOrder.store,
    customerEmail: checkoutOrder.customerEmail,
    totalPrice: lineItem.totalPrice,
    lineItems: [lineItem],
    shippingAddress: checkoutOrder.shippingAddress,
    billingAddress: checkoutOrder.billingAddress,
    customerGroup: checkoutOrder.customerGroup,
    country: checkoutOrder.country,
    taxRoundingMode: checkoutOrder.taxRoundingMode,
    taxCalculationMode: checkoutOrder.taxCalculationMode,
    origin: checkoutOrder.origin,
    itemShippingAddresses: checkoutOrder.itemShippingAddresses,
    custom: {
      type: {
        typeId: 'type',
        key: 'subscription-template-order',
      },
      fields: {
        ...checkoutOrder.custom.fields,
        nextDeliveryDate: nextDeliveryDateISOString,
        schedule,
        checkoutOrderRef: { typeId: 'order', id: checkoutOrder.id },
        reminderDays,
        nextReminderDate: nextReminderDateISOString,
      },
    },
    inventoryMode: 'None',
    state: {
      typeId: 'state',
      key: 'Active',
    },
  }
  delete templateOrder.custom.fields.hasSubscription
  return templateOrder
}

function _createPaymentDraft(payment) {
  const paymentDraft = _.cloneDeep(payment)
  delete paymentDraft.key
  return paymentDraft
}

export { createTemplateOrders }
