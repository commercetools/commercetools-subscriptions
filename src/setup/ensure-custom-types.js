import { createSyncTypes } from '@commercetools/sync-actions'
import { serializeError } from 'serialize-error'
import { readAndParseJsonFile } from '../utils/utils.js'
import { getSubscriptionSetupConfig } from '../config.js'

const subscriptionTemplateOrderType = await readAndParseJsonFile(
  './resources/subscription-template-order-type.json'
)
const checkoutOrderType = await readAndParseJsonFile(
  './resources/checkout-order-type.json'
)
const checkoutOrderLineItemType = await readAndParseJsonFile(
  './resources/checkout-order-line-item-type.json'
)
const subscriptionOrderType = await readAndParseJsonFile(
  './resources/subscription-order-type.json'
)

async function ensureCustomTypes(ctpClient, logger) {
  await mergeExistingTypesWithSubscriptionTypeDrafts(ctpClient)
  await syncCustomType(ctpClient, logger, subscriptionTemplateOrderType)
  await syncCustomType(ctpClient, logger, checkoutOrderType)
  await syncCustomType(ctpClient, logger, checkoutOrderLineItemType)
  await syncCustomType(ctpClient, logger, subscriptionOrderType)
}

async function syncCustomType(ctpClient, logger, typeDraft) {
  try {
    const existingType = await fetchTypeByKey(ctpClient, typeDraft.key)
    if (existingType === null) {
      await ctpClient.types().post({ body: typeDraft }).execute()
      logger.info(`Successfully created the type (key=${typeDraft.key})`)
    } else {
      const syncTypes = createSyncTypes()
      const updateActions = syncTypes
        .buildActions(typeDraft, existingType)
        .filter((i) => i.action !== 'changeFieldDefinitionOrder')
      if (updateActions.length > 0) {
        await ctpClient
          .types()
          .withId({ ID: existingType.id })
          .post({
            body: {
              actions: updateActions,
              version: existingType.version,
            },
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

async function fetchTypeByKey(ctpClient, key) {
  try {
    const { body } = await ctpClient.types().withKey({ key }).get().execute()
    return body
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

async function mergeExistingTypesWithSubscriptionTypeDrafts(ctpClient) {
  const config = getSubscriptionSetupConfig()
  const existingOrderTypeKey = config.existingOrderTypeKey
  if (existingOrderTypeKey)
    await fetchAndExtendSubscriptionType(
      ctpClient,
      existingOrderTypeKey,
      checkoutOrderType
    )

  const existingOrderLineItemTypeKey = config.existingOrderLineItemKey
  if (existingOrderLineItemTypeKey)
    await fetchAndExtendSubscriptionType(
      ctpClient,
      existingOrderLineItemTypeKey,
      checkoutOrderLineItemType
    )

  const existingSubscriptionOrderTypeKey =
    config.existingSubscriptionOrderTypeKey
  if (existingSubscriptionOrderTypeKey)
    await fetchAndExtendSubscriptionType(
      ctpClient,
      existingSubscriptionOrderTypeKey,
      subscriptionOrderType
    )
}

async function fetchAndExtendSubscriptionType(
  ctpClient,
  existingTypeKey,
  subscriptionTypeToExtend
) {
  const existingType = await fetchTypeByKey(ctpClient, existingTypeKey)
  if (existingType)
    subscriptionTypeToExtend.fieldDefinitions.push(
      ...existingType.fieldDefinitions
    )
}

export { ensureCustomTypes }
