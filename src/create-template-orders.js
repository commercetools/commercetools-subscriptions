import pMap from 'p-map'
import parser from 'cron-parser'
import _ from 'lodash'
import VError from 'verror'
import { getApiRoot, getCtpClient } from './utils/client.js'

const apiRoot = getApiRoot()
const ctpClient = getCtpClient()

async function _fetchLastStartTimestamp() {
  try {
    return (
      await apiRoot
        .customObjects()
        .withContainerAndKey({
          container: 'commercetools-subscriptions',
          key: 'subscriptions-lastStartTimestamp',
        })
        .get()
        .execute()
    ).body
  } catch (e) {
    if (e.code === 404) return null
    throw e
  }
}

async function _addPaymentWithRetry(
  templateOrder,
  addPaymentActions,
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
            actions: addPaymentActions,
            version,
          },
        })
        .execute()
      break
    } catch (err) {
      retryCount += 1
      const currentVersion = err.body.errors[0].currentVersion
      if (retryCount > maxRetry) {
        const retryMessage =
          'Got a concurrent modification error' +
          ` when creating template order with number "${templateOrder.orderNumber}".` +
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
    }
}

async function _createTemplateOrderAndPayments(checkoutOrder, orderDraft) {
  try {
    const checkoutPayments = checkoutOrder.paymentInfo?.payments?.map(
      (p) => p.obj
    )
    let addPaymentActions
    if (checkoutPayments) {
      const paymentDrafts = checkoutPayments.map(_createPaymentDraft)
      const paymentCreateResponses = await Promise.all(
        paymentDrafts.map((paymentDraft) =>
          apiRoot.payments().post({ body: paymentDraft }).execute()
        )
      )
      addPaymentActions = paymentCreateResponses.map(
        (paymentCreateResponse) => ({
          action: 'addPayment',
          payment: {
            type: 'payment',
            id: paymentCreateResponse.body.id,
          },
        })
      )
    }
    const { body: templateOrder } = await apiRoot
      .orders()
      .importOrder()
      .post({ body: orderDraft })
      .execute()

    if (addPaymentActions)
      await _addPaymentWithRetry(templateOrder, addPaymentActions)
  } catch (err) {
    if (!isDuplicateOrderError(err)) {
      const errMsg =
        `Unexpected error on creating template order from checkout order with number: ${checkoutOrder.orderNumber}.` +
        ` Line item: ${JSON.stringify(orderDraft.lineItems)}`
      throw new VError(err, errMsg)
    }
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

async function _processCheckoutOrder(checkoutOrder) {
  const templateOrderDrafts = _generateTemplateOrderDrafts(checkoutOrder)

  await pMap(
    templateOrderDrafts,
    async (templateOrderDraft) => {
      await _createTemplateOrderAndPayments(checkoutOrder, templateOrderDraft)
    },
    { concurrency: 3 }
  )

  await _setCheckoutOrderProcessed(checkoutOrder)
}

function isDuplicateOrderError(e) {
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
  for (const lineItem of checkoutOrder.lineItems)
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
    customerEmail: checkoutOrder.customerEmail,
    totalPrice: lineItem.totalPrice,
    lineItems: [lineItem],
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

async function _buildFetchUri() {
  let where =
    'custom(fields(hasSubscription=true)) AND custom(fields(isSubscriptionProcessed is not defined))'
  const lastStartTimestamp = await _fetchLastStartTimestamp()
  if (lastStartTimestamp)
    where = `createdAt > "${lastStartTimestamp.value}" AND ${where}`

  const uri = ctpClient.builder.orders
    .where(where)
    .expand('paymentInfo.payments[*]')
  return uri
}

async function _updateLastStartTimestamp(startDate) {
  await apiRoot
    .customObjects()
    .post({
      body: {
        container: 'commercetools-subscriptions',
        key: 'subscriptions-lastStartTimestamp',
        value: startDate.toISOString(),
      },
    })
    .execute()
}

async function createTemplateOrders(startDate) {
  const uri = await _buildFetchUri()

  const processCheckoutOrderPromises = []
  await ctpClient.fetchBatches(uri, (results) => {
    for (const order of results)
      processCheckoutOrderPromises.push(_processCheckoutOrder(order))
  })
  await pMap(processCheckoutOrderPromises, (f) => f, { concurrency: 3 })

  await _updateLastStartTimestamp(startDate)
}

export { createTemplateOrders }
