import { createSyncTypes } from '@commercetools/sync-actions'
import { serializeError } from 'serialize-error'
import { readAndParseJsonFile } from '../utils/utils.js'

const subscriptionTemplateOrderType
  = await readAndParseJsonFile('./resources/subscription-template-order-type.json')
const checkoutOrderType
  = await readAndParseJsonFile('./resources/checkout-order-type.json')
const checkoutOrderLineItemType
  = await readAndParseJsonFile('./resources/checkout-order-line-item-type.json')
const subscriptionOrderType
  = await readAndParseJsonFile('./resources/subscription-order-type.json')

async function ensureCustomTypes (ctpClient, logger) {
  await mergeExistingTypesWithSubscriptionTypeDrafts(ctpClient)
  await syncCustomType(
    ctpClient,
    logger,
    subscriptionTemplateOrderType
  )
  await syncCustomType(
    ctpClient,
    logger,
    checkoutOrderType
  )
  await syncCustomType(
    ctpClient,
    logger,
    checkoutOrderLineItemType
  )
  await syncCustomType(
    ctpClient,
    logger,
    subscriptionOrderType
  )
}

async function syncCustomType (ctpClient, logger, typeDraft) {
  try {
    const existingType = await fetchTypeByKey(ctpClient, typeDraft.key)
    if (existingType === null) {
      await ctpClient.types()
        .post({ body: typeDraft })
        .execute()
      logger.info(`Successfully created the type (key=${typeDraft.key})`)
    } else {
      const syncTypes = createSyncTypes()
      const updateActions = syncTypes
        .buildActions(typeDraft, existingType)
        .filter((i) => i.action !== 'changeFieldDefinitionOrder')
      if (updateActions.length > 0) {
        await ctpClient.types()
          .withId({ ID: existingType.id })
          .post({
            body: {
              actions: updateActions,
              version: existingType.version
            }
          })
          .execute()
        logger.info(`Successfully updated the type (key=${typeDraft.key})`)
      }
    }
  } catch (err) {
    throw Error(
      `Failed to sync type (key=${typeDraft.key}). ` +
      `Error: ${JSON.stringify(serializeError(err))}`
    )
  }
}

async function fetchTypeByKey (ctpClient, key) {
  try {
    const { body } = await ctpClient.types()
      .withKey({ key })
      .get()
      .execute()
    return body
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

async function mergeExistingTypesWithSubscriptionTypeDrafts (ctpClient) {
  const existingOrderTypeKey = process.env.EXISTING_ORDER_TYPE_KEY
  if (existingOrderTypeKey) {
    const existingOrderType = await fetchTypeByKey(ctpClient, existingOrderTypeKey)
    if (existingOrderType)
      checkoutOrderType.fieldDefinitions.push(...existingOrderType.fieldDefinitions)
  }
  const existingOrderLineItemTypeKey = process.env.EXISTING_ORDER_LINE_ITEM_TYPE_KEY
  if (existingOrderLineItemTypeKey) {
    const existingLineItemType = await fetchTypeByKey(ctpClient, existingOrderLineItemTypeKey)
    if (existingLineItemType)
      checkoutOrderLineItemType.fieldDefinitions.push(...existingLineItemType.fieldDefinitions)
  }
}

export {
  ensureCustomTypes
}
