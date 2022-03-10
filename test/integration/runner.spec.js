import { expect } from 'chai'
import { serializeError } from 'serialize-error'

import { ensureResources } from './test-utils.js'
import { run } from '../../src/runner.js'
import getLogger from '../../src/utils/logger.js'
import { getApiRoot } from '../../src/utils/client.js'

describe('runner', () => {
  const apiRoot = getApiRoot()
  const logger = getLogger()

  before(async () => {
    await ensureResources(apiRoot, logger)
  })

  it('should run the process without failure', async () => {
    try {
      await run()
    } catch (err) {
      expect.fail(`The main run function fails. Error: ${JSON.stringify(serializeError(err))}`)
    }
  })
})
