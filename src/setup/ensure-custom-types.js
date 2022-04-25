import VError from 'verror'
import { createSyncTypes } from '@commercetools/sync-actions'
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

async function ensureCustomTypes(apiRoot, logger) {
  await mergeExistingTypesWithSubscriptionTypeDrafts(apiRoot)
  await syncCustomType(apiRoot, logger, subscriptionTemplateOrderType)
  await syncCustomType(apiRoot, logger, checkoutOrderType)
  await syncCustomType(apiRoot, logger, checkoutOrderLineItemType)
  await syncCustomType(apiRoot, logger, subscriptionOrderType)
}

async function syncCustomType(apiRoot, logger, typeDraft) {
  try {
    const existingType = await fetchTypeByKey(apiRoot, typeDraft.key)
    if (existingType === null) {
      await apiRoot.types().post({ body: typeDraft }).execute()
      logger.info(`Successfully created the type (key=${typeDraft.key})`)
    } else {
      const syncTypes = createSyncTypes()
      const updateActions = syncTypes
        .buildActions(typeDraft, existingType)
        .filter((i) => i.action !== 'changeFieldDefinitionOrder')
      if (updateActions.length > 0) {
        await apiRoot
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
    throw new VError(err, `Failed to sync type (key=${typeDraft.key})`)
  }
}

async function fetchTypeByKey(apiRoot, key) {
  try {
    const { body } = await apiRoot.types().withKey({ key }).get().execute()
    return body
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

async function mergeExistingTypesWithSubscriptionTypeDrafts(apiRoot) {
  const config = getSubscriptionSetupConfig()
  const existingOrderTypeKey = config.existingOrderTypeKey
  if (existingOrderTypeKey)
    await fetchAndExtendSubscriptionType(
      apiRoot,
      existingOrderTypeKey,
      checkoutOrderType
    )

  const existingOrderLineItemTypeKey = config.existingOrderLineItemKey
  if (existingOrderLineItemTypeKey)
    await fetchAndExtendSubscriptionType(
      apiRoot,
      existingOrderLineItemTypeKey,
      checkoutOrderLineItemType
    )

  const existingSubscriptionOrderTypeKey =
    config.existingSubscriptionOrderTypeKey
  if (existingSubscriptionOrderTypeKey)
    await fetchAndExtendSubscriptionType(
      apiRoot,
      existingSubscriptionOrderTypeKey,
      subscriptionOrderType
    )
}

async function fetchAndExtendSubscriptionType(
  apiRoot,
  existingTypeKey,
  subscriptionTypeToExtend
) {
  const existingType = await fetchTypeByKey(apiRoot, existingTypeKey)
  if (existingType) {
    const fieldDefinitionNames = subscriptionTypeToExtend.fieldDefinitions.map(
      (fd) => fd.name
    )
    subscriptionTypeToExtend.fieldDefinitions.push(
      ...existingType.fieldDefinitions.filter(
        (fd) => !fieldDefinitionNames.includes(fd.name)
      )
    )
  }
}

export { ensureCustomTypes }
