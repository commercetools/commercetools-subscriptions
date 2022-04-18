import VError from 'verror'
import { createSyncStates } from '@commercetools/sync-actions'
import _ from 'lodash'
import { readAndParseJsonFile } from '../utils/utils.js'

const activeState = await readAndParseJsonFile('./resources/active-state.json')
const cancelledState = await readAndParseJsonFile(
  './resources/cancelled-state.json'
)
const errorState = await readAndParseJsonFile('./resources/error-state.json')
const pausedState = await readAndParseJsonFile('./resources/paused-state.json')
const reminderSentState = await readAndParseJsonFile(
  './resources/reminder-sent-state.json'
)
const sendReminderState = await readAndParseJsonFile(
  './resources/send-reminder-state.json'
)

async function ensureStates(apiRoot, logger) {
  await Promise.all(
    [
      activeState,
      cancelledState,
      errorState,
      pausedState,
      reminderSentState,
      sendReminderState,
    ].map(async (state) => {
      await syncState(apiRoot, logger, state)
    })
  )
}

async function syncState(apiRoot, logger, stateDraft) {
  try {
    let existingState = await fetchStateByKey(apiRoot, stateDraft.key)
    if (existingState === null) {
      const stateInit = _.cloneDeep(stateDraft)
      delete stateInit.transitions
      const response = await apiRoot
        .states()
        .post({ body: stateInit })
        .execute()
      existingState = response.body
      await checkAndDoUpdates(apiRoot, logger, stateDraft, existingState)
      logger.info(`Successfully created the state (key=${stateDraft.key})`)
    } else {
      removeTransitions(existingState, stateDraft)
      await checkAndDoUpdates(apiRoot, logger, stateDraft, existingState)
    }
  } catch (err) {
    throw new VError(err, `Failed to sync state (key=${stateDraft.key}).`)
  }
}

async function checkAndDoUpdates(apiRoot, logger, stateDraft, existingState) {
  const syncStates = createSyncStates()
  const updateActions = syncStates
    .buildActions(stateDraft, existingState)
    .filter((i) => i.action !== 'changeFieldDefinitionOrder')
  if (updateActions.length > 0) {
    await apiRoot
      .states()
      .withId({ ID: existingState.id })
      .post({
        body: {
          actions: updateActions,
          version: existingState.version,
        },
      })
      .execute()
    logger.info(`Successfully updated the state (key=${stateDraft.key})`)
  }
}

/**
 * For now we could not update the transitions since there is a bug in
 * the sync-actions module. Once it is fixed, this method could be removed.
 * @see https://github.com/commercetools/nodejs/issues/1765
 */
function removeTransitions(existingState, stateDraft) {
  delete stateDraft.transitions
  delete existingState.transitions
}

async function fetchStateByKey(apiRoot, key) {
  try {
    const { body } = await apiRoot
      .states()
      .withKey({ key })
      .get({
        queryArgs: {
          expand: 'transitions[*]',
        },
      })
      .execute()
    return body
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

export { ensureStates }
