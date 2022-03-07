import pMap from 'p-map'
import { randomUUID } from 'crypto'
import { ensureCustomTypes } from '../../src/setup/ensure-custom-types.js'
import { ensureStates } from '../../src/setup/ensure-states.js'
import { readAndParseJsonFile } from '../../src/utils/utils.js'

const zoneDraft = await readAndParseJsonFile('test/resources/zone-draft.json')
const taxCategoryDraft = await readAndParseJsonFile(
  'test/resources/tax-category-draft.json'
)
const productTypeDraft = await readAndParseJsonFile(
  'test/resources/product-type-draft.json'
)
const productDrafts = await readAndParseJsonFile(
  'test/resources/product-drafts.json'
)
const shippingMethodDraft = await readAndParseJsonFile(
  'test/resources/shipping-method-draft.json'
)
const paymentDraft = await readAndParseJsonFile(
  'test/resources/payment-draft.json'
)
const orderDraft = await readAndParseJsonFile('test/resources/order-draft.json')

async function ensureResources(apiRoot, logger) {
  await ensureCustomTypes(apiRoot, logger)
  await ensureStates(apiRoot, logger)
  const zone = await ensureZones(apiRoot)
  const taxCategory = await ensureTaxCategories(apiRoot)
  const shippingMethodsResponse = await ensureShippingMethod(
    apiRoot,
    zone.id,
    taxCategory.id
  )
  const shippingMethodId = shippingMethodsResponse.id
  await ensureProductType(apiRoot)
  const productsResponse = await ensureProducts(apiRoot)
  return {
    productIds: productsResponse.map((p) => p.id),
    shippingMethodId,
  }
}

async function createOrderByOrderNumber(
  apiRoot,
  logger,
  productIds,
  shippingMethodId,
  orderNumber
) {
  const paymentResponse = await createPayment(apiRoot)
  return createOrder(apiRoot, logger, paymentResponse.id, orderNumber)
}

async function ensureZones(apiRoot) {
  let {
    body: {
      results: [zone],
    },
  } = await apiRoot
    .zones()
    .get({ queryArgs: { limit: 1 } })
    .execute()

  if (!zone)
    zone = (await apiRoot.zones().post({ body: zoneDraft }).execute()).body

  return zone
}

async function ensureTaxCategories(apiRoot) {
  let {
    body: {
      results: [taxCategory],
    },
  } = await apiRoot
    .taxCategories()
    .get({ queryArgs: { limit: 1 } })
    .execute()

  if (!taxCategory)
    taxCategory = (
      await apiRoot.taxCategories().post({ body: taxCategoryDraft }).execute()
    ).body

  return taxCategory
}

async function ensureShippingMethod(apiRoot, zoneId, taxCategoryId) {
  let {
    body: {
      results: [shippingMethod],
    },
  } = await apiRoot
    .shippingMethods()
    .get({ queryArgs: { limit: 1 } })
    .execute()

  if (!shippingMethod) {
    shippingMethodDraft.taxCategory.id = `${taxCategoryId}`
    for (let i = 0; i < shippingMethodDraft.zoneRates.length; i++)
      shippingMethodDraft.zoneRates[i].zone.id = `${zoneId}`

    shippingMethod = (
      await apiRoot
        .shippingMethods()
        .post({
          body: shippingMethodDraft,
        })
        .execute()
    ).body
  }
  return shippingMethod
}

async function ensureProductType(apiRoot) {
  let {
    body: {
      results: [productType],
    },
  } = await apiRoot
    .productTypes()
    .get({ queryArgs: { limit: 1 } })
    .execute()

  if (!productType)
    productType = (
      await apiRoot
        .productTypes()
        .post({
          body: productTypeDraft,
        })
        .execute()
    ).body

  return productType
}

async function ensureProducts(apiRoot) {
  const products = await pMap(
    productDrafts,
    async (product) => createAndPublishProduct(apiRoot, product),
    { concurrency: 5 }
  )

  return products
}

async function createAndPublishProduct(apiRoot, productDraft) {
  try {
    const { body: product } = await apiRoot
      .products()
      .withKey({ key: productDraft.key })
      .get()
      .execute()
    return product
  } catch (err) {
    if (err.status === 404) {
      const { body } = await apiRoot
        .products()
        .post({
          body: productDraft,
        })
        .execute()
      return (
        await apiRoot
          .products()
          .withId({ ID: body.id })
          .post({
            body: {
              version: body.version,
              actions: [
                {
                  action: 'publish',
                },
              ],
            },
          })
          .execute()
      ).body
    }
    throw err
  }
}

async function createPayment(apiRoot) {
  const payment = (
    await apiRoot
      .payments()
      .post({
        body: paymentDraft,
      })
      .execute()
  ).body
  return payment
}

async function createOrder(apiRoot, logger, paymentId, orderNumber) {
  orderDraft.orderNumber = orderNumber
  orderDraft.lineItems.forEach((lineItem) => {
    if (lineItem.custom?.fields?.subscriptionKey === '')
      lineItem.custom.fields.subscriptionKey = `${randomUUID()}_subscriptionKey`
  })
  let order
  try {
    logger.debug(
      `About to create order in test project with orderNumber ${orderNumber}`
    )
    const { body } = await apiRoot
      .orders()
      .importOrder()
      .post({ body: orderDraft })
      .execute()
    const updateActions = [
      {
        action: 'addPayment',
        payment: {
          type: 'payment',
          id: paymentId,
        },
      },
    ]
    const { body: orderWithPayment } = await apiRoot
      .orders()
      .withId({ ID: body.id })
      .post({
        body: {
          actions: updateActions,
          version: body.version,
        },
        queryArgs: {
          expand: 'paymentInfo.payments[*]',
        },
      })
      .execute()
    order = orderWithPayment
  } catch (e) {
    logger.debug('Failed to create order in test project.', e)
    logger.debug('Fetch order by number.')
    order = await fetchOrderByOrderNumber(apiRoot, orderNumber)
  }

  return order
}

async function fetchOrderByOrderNumber(apiRoot, orderNumber) {
  const { body: order } = await apiRoot
    .orders()
    .withOrderNumber({ orderNumber })
    .get()
    .execute()
  return order
}

function isValidDate(d) {
  // eslint-disable-next-line no-restricted-globals
  return d instanceof Date && !isNaN(d)
}

async function reloadModule(path) {
  return import(`${path}?testName=${randomUUID()}`)
}

export { ensureResources, createOrderByOrderNumber, isValidDate, reloadModule }
