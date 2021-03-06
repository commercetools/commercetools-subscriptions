import { expect } from 'chai'
import _ from 'lodash'

import { ensureResources, createOrderByOrderNumber } from './test-utils.js'

import getLogger from '../../src/utils/logger.js'
import { getApiRoot } from '../../src/utils/client.js'
import { ACTIVE_STATE } from '../../src/states-constants.js'
import { createTemplateOrders } from '../../src/create-template-orders.js'

describe('create-template-orders', () => {
  const apiRoot = getApiRoot()
  const logger = getLogger()
  const DAY_IN_MS = 24 * 60 * 60 * 1000

  before(async () => {
    await ensureResources(apiRoot, logger)
  })

  it('should create a template order from the checkout order', async () => {
    const orderNumber = new Date().getTime().toString()
    const checkoutOrder = await createOrderByOrderNumber(
      apiRoot,
      logger,
      orderNumber
    )
    const {
      body: { results: states },
    } = await apiRoot.states().get().execute()
    const stateKeyToIdMap = new Map(
      states.map((state) => [state.key, state.id])
    )
    await createTemplateOrders({
      apiRoot,
      logger,
      startDate: new Date(),
      activeStateId: stateKeyToIdMap.get(ACTIVE_STATE),
    })

    const {
      body: { results: templateOrders },
    } = await apiRoot
      .orders()
      .get({
        queryArgs: {
          where: `custom(fields(checkoutOrderRef(id="${checkoutOrder.id}")))`,
          expand: ['paymentInfo.payments[*]', 'state'],
        },
      })
      .execute()

    expect(templateOrders).to.have.lengthOf(4)
    assertTemplateOrderAttributes(checkoutOrder, templateOrders)
    assertCustomFieldsEqual(checkoutOrder, templateOrders)
    assertLineItemsEqual(checkoutOrder, templateOrders)
    assertTemplateOrderCustomFields(checkoutOrder, templateOrders)
    assertPayments(checkoutOrder, templateOrders)
    const { body: checkoutOrderUpdated } = await apiRoot
      .orders()
      .withId({ ID: checkoutOrder.id })
      .get()
      .execute()
    expect(checkoutOrderUpdated.custom.fields.isSubscriptionProcessed).to.be
      .true
  })

  function assertTemplateOrderAttributes(checkoutOrder, templateOrders) {
    templateOrders.forEach((templateOrder) => {
      const checkoutOrderLineItem = findMatchingCheckoutLineItem(
        checkoutOrder,
        templateOrder
      )
      if (checkoutOrderLineItem.quantity > 1)
        expect(templateOrder.orderNumber).to.match(
          /(([a-f0-9\\-]*){1}\s*)_subscriptionKey-([0-9]+)/g
        )
      else
        expect(templateOrder.orderNumber).to.equal(
          checkoutOrderLineItem.custom.fields.subscriptionKey
        )
      expect(templateOrder.state.obj.key).to.equal(ACTIVE_STATE)
      expect(templateOrder.customerId).to.equal(checkoutOrder.customerId)
      expect(templateOrder.customerEmail).to.equal(checkoutOrder.customerEmail)
      expect(templateOrder.shippingAddress).to.equal(
        checkoutOrder.shippingAddress
      )
      expect(templateOrder.billingAddress).to.equal(
        checkoutOrder.billingAddress
      )
      expect(templateOrder.customerGroup).to.equal(checkoutOrder.customerGroup)
      expect(templateOrder.country).to.equal(checkoutOrder.country)
      expect(templateOrder.shippingInfo.price).to.deep.equal(
        checkoutOrder.shippingInfo.price
      )
      expect(templateOrder.shippingInfo.shippingMethod).to.deep.equal(
        checkoutOrder.shippingInfo.shippingMethod
      )
      expect(templateOrder.shippingInfo.shippingRate).to.deep.equal(
        checkoutOrder.shippingInfo.shippingRate
      )
      expect(templateOrder.shippingInfo.shippingMethodName).to.deep.equal(
        checkoutOrder.shippingInfo.shippingMethodName
      )
      expect(templateOrder.taxMode).to.equal(checkoutOrder.taxMode)
      expect(templateOrder.inventoryMode).to.equal('None')
    })
  }

  function assertPayments(checkoutOrder, templateOrders) {
    const checkoutOrderPayment = _.cloneDeep(
      checkoutOrder.paymentInfo.payments[0].obj
    )
    delete checkoutOrderPayment.id
    delete checkoutOrderPayment.createdAt
    delete checkoutOrderPayment.lastModifiedAt
    delete checkoutOrderPayment.versionModifiedAt

    templateOrders.forEach((templateOrder) => {
      const templateOrderPayment = _.cloneDeep(
        templateOrder.paymentInfo.payments[0].obj
      )
      delete templateOrderPayment.id
      delete templateOrderPayment.createdAt
      delete templateOrderPayment.lastModifiedAt
      delete templateOrderPayment.versionModifiedAt
      expect(checkoutOrderPayment).to.deep.equal(templateOrderPayment)
    })
  }

  function assertCustomFieldsEqual(checkoutOrder, templateOrders) {
    const checkoutOrderCustomFields = _.cloneDeep(checkoutOrder.custom.fields)
    delete checkoutOrderCustomFields.hasSubscription
    delete checkoutOrderCustomFields.isSubscriptionProcessed
    templateOrders.forEach((templateOrder) => {
      expect(templateOrder.custom.fields).to.include(checkoutOrderCustomFields)
    })
  }

  function assertLineItemsEqual(checkoutOrder, templateOrders) {
    templateOrders.forEach((templateOrder) => {
      const checkoutOrderLineItem = _.cloneDeep(
        findMatchingCheckoutLineItem(checkoutOrder, templateOrder)
      )
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
    })
  }

  function assertTemplateOrderCustomFields(checkoutOrder, templateOrders) {
    templateOrders.forEach((templateOrder) => {
      const nextDeliveryDate = new Date(
        templateOrder.custom.fields.nextDeliveryDate
      )
      if (checkoutOrder.custom.fields.nextReminderDate) {
        const nextReminderDate = new Date(
          templateOrder.custom.fields.nextReminderDate
        )
        const { reminderDays } = templateOrder.custom.fields
        expect(nextDeliveryDate.getTime() - reminderDays * DAY_IN_MS).to.equal(
          nextReminderDate.getTime()
        )
      }
      expect(templateOrder.custom.fields.checkoutOrderRef.id).to.equal(
        checkoutOrder.id
      )
    })
  }

  function findMatchingCheckoutLineItem(checkoutOrder, templateOrder) {
    return checkoutOrder.lineItems.find((lineItem) =>
      templateOrder.orderNumber.includes(lineItem.custom.fields.subscriptionKey)
    )
  }
})
