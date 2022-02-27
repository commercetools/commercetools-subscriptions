import { expect } from 'chai'
import _ from 'lodash'

import { ensureResources, createOrderByOrderNumber } from './test-utils.js'
import { run } from '../../src/runner.js'
import getLogger from '../../src/utils/logger.js'
import { getApiRoot } from '../../src/utils/client.js'

describe('runner', () => {
  const apiRoot = getApiRoot()
  const logger = getLogger()
  let productIds
  let shippingMethodId
  const DAY_IN_MS = 24 * 60 * 60 * 1000

  before(async () => {
    const resources = await ensureResources(apiRoot, logger)
    productIds = resources.productIds
    shippingMethodId = resources.shippingMethodId
  })

  it('should create a template order from the checkout order', async () => {
    const orderNumber = new Date().getTime().toString()
    const checkoutOrder = await createOrderByOrderNumber(
      apiRoot,
      logger,
      productIds,
      shippingMethodId,
      orderNumber
    )
    await run()

    const {
      body: {
        results: [templateOrder],
      },
    } = await apiRoot
      .orders()
      .get({
        queryArgs: {
          where: `custom(fields(checkoutOrderRef(id="${checkoutOrder.id}")))`,
        },
      })
      .execute()

    expect(templateOrder).to.exist
    assertCustomFieldsEqual(checkoutOrder, templateOrder)
    assertLineItemsEqual(checkoutOrder, templateOrder)
    assertTemplateOrderCustomFields(checkoutOrder, templateOrder)

    const { body: checkoutOrderUpdated } = await apiRoot
      .orders()
      .withId({ ID: checkoutOrder.id })
      .get()
      .execute()
    expect(checkoutOrderUpdated.custom.fields.isSubscriptionProcessed).to.be
      .true
  })

  function assertCustomFieldsEqual(checkoutOrder, templateOrder) {
    const checkoutOrderCustomFields = _.cloneDeep(checkoutOrder.custom.fields)
    delete checkoutOrderCustomFields.hasSubscription
    delete checkoutOrderCustomFields.isSubscriptionProcessed
    expect(templateOrder.custom.fields).to.include(checkoutOrderCustomFields)
  }

  function assertLineItemsEqual(checkoutOrderUpdated, templateOrder) {
    const checkoutOrderLineItem = _.cloneDeep(checkoutOrderUpdated.lineItems[0])
    delete checkoutOrderLineItem.addedAt
    delete checkoutOrderLineItem.id
    delete checkoutOrderLineItem.lastModifiedAt
    delete checkoutOrderLineItem.price.id
    delete checkoutOrderLineItem.variant.prices[0].id

    const templateOrderLineItem = _.cloneDeep(templateOrder.lineItems[0])
    delete templateOrderLineItem.addedAt
    delete templateOrderLineItem.id
    delete templateOrderLineItem.lastModifiedAt
    delete templateOrderLineItem.price.id
    delete templateOrderLineItem.variant.prices[0].id

    expect(templateOrderLineItem).to.deep.equal(checkoutOrderLineItem)
  }

  function assertTemplateOrderCustomFields(checkoutOrder, templateOrder) {
    expect(templateOrder.orderNumber).to.equal(
      checkoutOrder.lineItems[0].custom.fields.subscriptionKey
    )
    const nextDeliveryDate = new Date(
      templateOrder.custom.fields.nextDeliveryDate
    )
    const nextReminderDate = new Date(
      templateOrder.custom.fields.nextReminderDate
    )
    const reminderDays = templateOrder.custom.fields.reminderDays
    expect(nextDeliveryDate.getTime() - reminderDays * DAY_IN_MS).to.equal(
      nextReminderDate.getTime()
    )
    expect(templateOrder.custom.fields.checkoutOrderRef.id).to.equal(
      checkoutOrder.id
    )
  }
})
