import { expect } from 'chai'

import { ensureResources, createOrderByOrderNumber } from './test-utils.js'
import { run } from '../../src/runner.js'
import getLogger from '../../src/utils/logger.js'
import getApiRoot from '../../src/utils/client.js'

describe('runner', () => {
  const apiRoot = getApiRoot()
  const logger = getLogger()
  let productIds
  let shippingMethodId

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
      body: [templateOrder],
    } = await apiRoot
      .orders()
      .get({
        queryArgs: {
          where: `custom(fields(checkoutOrderRef="${checkoutOrder.id}"))`,
        },
      })
      .execute()

    expect(templateOrder).to.exist
  })
})
