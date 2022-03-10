import nock from 'nock'
import { expect } from 'chai'
import timekeeper from 'timekeeper'
import getLogger from '../../src/utils/logger.js'
import { reloadModule } from '../integration/test-utils.js'
import { sendReminders } from '../../src/send-reminders.js'

describe('send-reminders', () => {
  let ctpProjectKey
  let ctpClientId
  let ctpClientSecret
  let logger
  let apiRoot
  let ctpClient
  const CTP_API_URL = 'https://api.europe-west1.gcp.commercetools.com'
  const CTP_AUTH_URL = 'https://auth.europe-west1.gcp.commercetools.com'
  const PROJECT_KEY = 'project-key'

  before(async () => {
    _mockCtpEnvVars()
    const { getApiRoot, getCtpClient } = await reloadModule(
      '../../src/utils/client.js'
    )
    logger = getLogger()
    apiRoot = getApiRoot()
    ctpClient = getCtpClient()
  })

  after(() => {
    _restoreCtpEnvVars()
  })

  beforeEach(() => {
    _mockCtpOAuthEndpoint()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it(
    'given Active template orders ' +
      'when the nextReminderDate <= now' +
      'then it should set state "commercetools-subscriptions-sendReminder"',
    async () => {
      _mockActiveState()
      _mockTemplateOrders()
      const sendReminderStateSet = nock(CTP_API_URL)
        .post(
          `/${PROJECT_KEY}/orders/aca5925a-7078-4455-8e0f-3956069418c6`,
          (body) =>
            JSON.stringify(body) ===
            JSON.stringify({
              actions: [
                {
                  action: 'transitionState',
                  state: {
                    typeId: 'state',
                    key: 'commercetools-subscriptions-sendReminder',
                  },
                },
              ],
              version: 3,
            })
        )
        .reply(200)

      const stats = await sendReminders({ apiRoot, ctpClient, logger })
      expect(stats).to.deep.equal({
        processedTemplateOrders: 1,
        skippedTemplateOrders: 0,
        updatedTemplateOrders: 1,
      })
      expect(sendReminderStateSet.isDone()).to.be.true
    }
  )

  it('should skip processing if there is no matching template orders', async () => {
    _mockActiveState()
    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes(
          'TemplateOrdersThatIsReadyToSendReminderOrdersQuery'
        )
      )
      .reply(200, {
        data: {
          orders: {
            results: [],
          },
        },
      })
    const stats = await sendReminders({ apiRoot, ctpClient, logger })
    expect(stats).to.deep.equal({
      processedTemplateOrders: 0,
      skippedTemplateOrders: 0,
      updatedTemplateOrders: 0,
    })
  })

  describe('error handling', () => {
    it('should retry on 409s', async () => {
      _mockActiveState()
      _mockTemplateOrders()
      const sendReminderStateSet = nock(CTP_API_URL)
        .post(
          `/${PROJECT_KEY}/orders/aca5925a-7078-4455-8e0f-3956069418c6`,
          (body) =>
            body.actions.some((action) => action.action === 'transitionState')
        )
        .reply(409, {
          statusCode: 409,
          message: 'Version mismatch. Concurrent modification.',
          errors: [
            {
              code: 'ConcurrentModification',
              message: 'Version mismatch. Concurrent modification.',
              currentVersion: 4,
            },
          ],
        })
        .post(
          `/${PROJECT_KEY}/orders/aca5925a-7078-4455-8e0f-3956069418c6`,
          (body) =>
            body.actions.some(
              (action) => action.action === 'transitionState'
            ) && body.version === 4
        )
        .reply(200)

      const orderRefetched = nock(CTP_API_URL)
        .get(`/${PROJECT_KEY}/orders`)
        .query((actualQueryObject) =>
          actualQueryObject.where.includes(
            'id="aca5925a-7078-4455-8e0f-3956069418c6" ' +
              'AND state(id="activeStateId") AND custom(fields(nextReminderDate <='
          )
        )
        .reply(200, {
          results: [
            {
              version: 4,
            },
          ],
        })

      try {
        // exact same date
        timekeeper.freeze(new Date('2022-04-25T22:00:00.000Z'))
        const stats = await sendReminders({ apiRoot, ctpClient, logger })
        expect(stats).to.deep.equal({
          processedTemplateOrders: 1,
          skippedTemplateOrders: 0,
          updatedTemplateOrders: 1,
        })
        expect(sendReminderStateSet.isDone()).to.be.true
        expect(orderRefetched.isDone()).to.be.true
      } finally {
        timekeeper.reset()
      }
    })

    it('should skip on 409 when the sendReminder condition does not match', async () => {
      _mockActiveState()
      _mockTemplateOrders()
      const sendReminderStateSet = nock(CTP_API_URL)
        .post(
          `/${PROJECT_KEY}/orders/aca5925a-7078-4455-8e0f-3956069418c6`,
          (body) =>
            body.actions.some((action) => action.action === 'transitionState')
        )
        .reply(409, {
          statusCode: 409,
          message: 'Version mismatch. Concurrent modification.',
          errors: [
            {
              code: 'ConcurrentModification',
              message: 'Version mismatch. Concurrent modification.',
              currentVersion: 4,
            },
          ],
        })
      const orderRefetched = nock(CTP_API_URL)
        .get(`/${PROJECT_KEY}/orders`)
        .query((actualQueryObject) =>
          actualQueryObject.where.includes(
            'id="aca5925a-7078-4455-8e0f-3956069418c6" ' +
              'AND state(id="activeStateId") AND custom(fields(nextReminderDate <='
          )
        )
        .reply(200, {
          results: [],
        })

      try {
        // 15 min before
        timekeeper.freeze(new Date('2022-04-25T21:45:00.000Z'))
        const stats = await sendReminders({ apiRoot, ctpClient, logger })
        expect(stats).to.deep.equal({
          processedTemplateOrders: 1,
          skippedTemplateOrders: 1,
          updatedTemplateOrders: 0,
        })
        expect(sendReminderStateSet.isDone()).to.be.true
        expect(orderRefetched.isDone()).to.be.true
      } finally {
        timekeeper.reset()
      }
    })

    it('should fail process on 5xxs', async () => {
      _mockActiveState()
      _mockTemplateOrders()

      // currently no retry for 5xx.
      const sendReminderStateSet = nock(CTP_API_URL)
        .post(
          `/${PROJECT_KEY}/orders/aca5925a-7078-4455-8e0f-3956069418c6`,
          (body) =>
            body.actions.some((action) => action.action === 'transitionState')
        )
        .times(1)
        .reply(500, {
          message: 'Some TEST API error',
        })

      const stats = await sendReminders({ apiRoot, ctpClient, logger })
      expect(stats).to.deep.equal({
        processedTemplateOrders: 1,
        skippedTemplateOrders: 0,
        updatedTemplateOrders: 0,
      })
      expect(sendReminderStateSet.isDone()).to.be.true
    })
  })

  function _mockCtpOAuthEndpoint() {
    nock(CTP_AUTH_URL).persist().post('/oauth/token').reply(200, {
      access_token: 'hFuRNd4EjwTZOb2qUDqXxXrw0dMI-K-A',
      token_type: 'Bearer',
      scope: 'manage_project:project-id',
      expires_in: 172274,
    })
  }

  function _mockCtpEnvVars() {
    ctpProjectKey = process.env.CTP_PROJECT_KEY
    ctpClientId = process.env.CTP_CLIENT_ID
    ctpClientSecret = process.env.CTP_CLIENT_SECRET
    process.env.CTP_PROJECT_KEY = 'project-key'
    process.env.CTP_CLIENT_ID = 'client_id'
    process.env.CTP_CLIENT_SECRET = 'client_secret'
  }

  function _restoreCtpEnvVars() {
    process.env.CTP_PROJECT_KEY = ctpProjectKey
    process.env.CTP_CLIENT_ID = ctpClientId
    process.env.CTP_CLIENT_SECRET = ctpClientSecret
  }

  function _mockActiveState() {
    nock(CTP_API_URL)
      .persist()
      .get(`/${PROJECT_KEY}/states/key=commercetools-subscriptions-active`)
      .reply(200, {
        id: 'activeStateId',
      })
  }

  function _mockTemplateOrders() {
    const templateOrdersResponse = {
      data: {
        orders: {
          results: [
            {
              id: 'aca5925a-7078-4455-8e0f-3956069418c6',
              orderNumber:
                'bb698c7d-77f0-4985-855e-d4189a57f128_subscriptionKey',
              version: 3,
            },
          ],
        },
      },
    }
    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes(
          'TemplateOrdersThatIsReadyToSendReminderOrdersQuery'
        )
      )
      .reply(200, templateOrdersResponse)
  }
})
