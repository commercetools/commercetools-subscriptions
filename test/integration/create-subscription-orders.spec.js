import { expect } from 'chai'
import { createSubscriptionOrders } from '../../src/create-subscription-orders.js'
import { getApiRoot, getCtpClient } from '../../src/utils/client.js'
import getLogger from '../../src/utils/logger.js'
import { ensureResources, createTemplateOrder } from './test-utils.js'
import { ACTIVE_STATE } from '../../src/states-constants.js'

describe('create-subscription-orders', () => {
  const apiRoot = getApiRoot()
  const ctpClient = getCtpClient()
  const logger = getLogger()
  let productIds
  let shippingMethodId

  before(async () => {
    const resources = await ensureResources(apiRoot, logger)
    productIds = resources.productIds
    shippingMethodId = resources.shippingMethodId
  })

  it('should call subscription order endpoint and process template orders', async () => {
    const templateOrder = await createTemplateOrder(
      apiRoot,
      logger,
      productIds,
      shippingMethodId
    )
    const {
      body: { results: states },
    } = await apiRoot.states().get().execute()
    const stateKeyToIdMap = new Map(
      states.map((state) => [state.key, state.id])
    )
    await createSubscriptionOrders({
      apiRoot,
      ctpClient,
      logger,
      stateKeyToIdMap,
    })

    const { body: templateOrderUpdated } = await apiRoot
      .orders()
      .withId({ ID: templateOrder.id })
      .get({ queryArgs: { expand: ['state'] } })
      .execute()

    const nextDeliveryDateOld = new Date(
      templateOrder.custom.fields.nextDeliveryDate
    )
    const nextDeliveryDateNew = new Date(
      templateOrderUpdated.custom.fields.nextDeliveryDate
    )
    expect(nextDeliveryDateNew).to.be.greaterThan(nextDeliveryDateOld)
    const nextReminderDateOld = new Date(
      templateOrder.custom.fields.nextReminderDate
    )
    const nextReminderDateNew = new Date(
      templateOrderUpdated.custom.fields.nextReminderDate
    )
    expect(nextReminderDateNew).to.be.greaterThan(nextReminderDateOld)
    expect(templateOrderUpdated.state.obj.key).to.equal(ACTIVE_STATE)
  })
})
