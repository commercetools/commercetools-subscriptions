import nock from 'nock'
import { expect } from 'chai'
import { createSubscriptionOrders } from '../../src/create-subscription-orders.js'
import { reloadModule } from '../integration/test-utils.js'
import getLogger from '../../src/utils/logger.js'
import { readAndParseJsonFile } from '../../src/utils/utils.js'
import {
  ACTIVE_STATE,
  ERROR_STATE,
  REMINDER_SENT_STATE,
  SEND_REMINDER_STATE,
} from '../../src/states-constants.js'

const templateOrdersToCreateSubscriptionGraphqlResponse =
  await readAndParseJsonFile(
    'test/unit/mocks/template-orders-to-create-subscriptions-graphql.json'
  )

describe('create-subscription-orders', () => {
  let ctpProjectKey
  let ctpClientId
  let ctpClientSecret
  let subscriptionOrderCreationUrl
  let customHeaders
  let basicAuthUsername
  let basicAuthPassword
  let logger
  let apiRoot
  let ctpClient
  const CTP_API_URL = 'https://api.europe-west1.gcp.commercetools.com'
  const CTP_AUTH_URL = 'https://auth.europe-west1.gcp.commercetools.com'
  const SUBSCRIPTION_ORDER_CREATION_URL = 'https://subscription-url.com'
  const PROJECT_KEY = 'project-key'
  const TEMPLATE_ORDER_ID = '6ea7dbba-be0e-49d3-975d-fe214e094eae'
  const stateKeyToIdMap = new Map([
    [ACTIVE_STATE, '1'],
    [SEND_REMINDER_STATE, '2'],
    [REMINDER_SENT_STATE, '3'],
  ])

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

  it('should skip processing if there is no matching template orders', async () => {
    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('TemplateOrdersToCreateSubscriptionOrders')
      )
      .reply(200, {
        data: {
          orders: {
            results: [],
          },
        },
      })

    const stats = await createSubscriptionOrders({
      apiRoot,
      ctpClient,
      logger,
      stateKeyToIdMap,
    })
    expect(stats).to.deep.equal({
      processedTemplateOrders: 0,
      subscriptionOrderAlreadyCreated: 0,
      successUrlCalls: 0,
      recoverableErrorUrlCalls: 0,
      unrecoverableErrorUrlCalls: 0,
    })
  })

  it('should call URL with correct headers and authorizations', async () => {
    let headers
    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('TemplateOrdersToCreateSubscriptionOrders')
      )
      .reply(200, templateOrdersToCreateSubscriptionGraphqlResponse)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('CheckExistingSubscriptionOrder')
      )
      .reply(200, {
        data: {
          orders: {
            results: [],
          },
        },
      })
      .post(`/${PROJECT_KEY}/orders/${TEMPLATE_ORDER_ID}`)
      .reply(200)

    nock(SUBSCRIPTION_ORDER_CREATION_URL)
      .post('/')
      .reply(function (uri, requestBody, callback) {
        headers = this.req.headers
        callback(null, [200])
      })

    const stats = await createSubscriptionOrders({
      apiRoot,
      ctpClient,
      logger,
      stateKeyToIdMap,
    })
    expect(stats).to.deep.equal({
      processedTemplateOrders: 1,
      subscriptionOrderAlreadyCreated: 0,
      successUrlCalls: 1,
      recoverableErrorUrlCalls: 0,
      unrecoverableErrorUrlCalls: 0,
    })

    expect(headers['loyalty-partner-forward'][0]).to.equal('123')
    expect(headers['authorization'][0]).to.equal(
      'Basic dXNlcm5hbWU6cGFzc3dvcmQ='
    )
  })

  it('when subscription order already exists, it should skip calling URL and only updates template order', async () => {
    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('TemplateOrdersToCreateSubscriptionOrders')
      )
      .reply(200, templateOrdersToCreateSubscriptionGraphqlResponse)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('CheckExistingSubscriptionOrder')
      )
      .reply(200, {
        data: {
          orders: {
            results: [{ version: 2 }],
          },
        },
      })
      .post(`/${PROJECT_KEY}/orders/${TEMPLATE_ORDER_ID}`)
      .reply(200)

    const scope = nock(SUBSCRIPTION_ORDER_CREATION_URL).post('/').reply(200)

    const stats = await createSubscriptionOrders({
      apiRoot,
      ctpClient,
      logger,
      stateKeyToIdMap,
    })
    expect(stats).to.deep.equal({
      processedTemplateOrders: 1,
      subscriptionOrderAlreadyCreated: 1,
      successUrlCalls: 0,
      recoverableErrorUrlCalls: 0,
      unrecoverableErrorUrlCalls: 0,
    })

    expect(scope.isDone()).to.be.false
  })

  Array.from({ length: 100 }, (_, i) => i + 500)
    .concat(401, 403)
    .forEach((errorCode) => {
      it(`should skip updating template order when calling URL returns ${errorCode} HTTP error`, async () => {
        nock(CTP_API_URL)
          .post(`/${PROJECT_KEY}/graphql`, (body) =>
            body.query.includes('TemplateOrdersToCreateSubscriptionOrders')
          )
          .reply(200, templateOrdersToCreateSubscriptionGraphqlResponse)
          .post(`/${PROJECT_KEY}/graphql`, (body) =>
            body.query.includes('CheckExistingSubscriptionOrder')
          )
          .reply(200, {
            data: {
              orders: {
                results: [],
              },
            },
          })

        const templateOrderUpdateScope = nock(CTP_API_URL)
          .post(`/${PROJECT_KEY}/orders/${TEMPLATE_ORDER_ID}`)
          .reply(200)

        nock(SUBSCRIPTION_ORDER_CREATION_URL).post('/').reply(401)

        const stats = await createSubscriptionOrders({
          apiRoot,
          ctpClient,
          logger,
          stateKeyToIdMap,
        })
        expect(stats).to.deep.equal({
          processedTemplateOrders: 1,
          subscriptionOrderAlreadyCreated: 0,
          successUrlCalls: 0,
          recoverableErrorUrlCalls: 1,
          unrecoverableErrorUrlCalls: 0,
        })
        expect(templateOrderUpdateScope.isDone()).to.be.false
      })
    })

  it('should set template order to Error and skip when calling URL returns 400 HTTP error', async () => {
    let templateOrderUpdates
    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('TemplateOrdersToCreateSubscriptionOrders')
      )
      .reply(200, templateOrdersToCreateSubscriptionGraphqlResponse)
      .post(`/${PROJECT_KEY}/graphql`, (body) =>
        body.query.includes('CheckExistingSubscriptionOrder')
      )
      .reply(200, {
        data: {
          orders: {
            results: [],
          },
        },
      })
      .post(`/${PROJECT_KEY}/orders/${TEMPLATE_ORDER_ID}`, (body) => {
        templateOrderUpdates = body
        return true
      })
      .reply(200)

    nock(SUBSCRIPTION_ORDER_CREATION_URL).post('/').reply(400)

    const stats = await createSubscriptionOrders({
      apiRoot,
      ctpClient,
      logger,
      stateKeyToIdMap,
    })
    expect(stats).to.deep.equal({
      processedTemplateOrders: 1,
      subscriptionOrderAlreadyCreated: 0,
      successUrlCalls: 0,
      recoverableErrorUrlCalls: 0,
      unrecoverableErrorUrlCalls: 1,
    })
    expect(templateOrderUpdates).to.deep.equal({
      actions: [
        {
          action: 'transitionState',
          state: {
            typeId: 'state',
            key: ERROR_STATE,
          },
        },
      ],
      version: 3,
    })
  })

  function _mockCtpEnvVars() {
    ctpProjectKey = process.env.CTP_PROJECT_KEY
    ctpClientId = process.env.CTP_CLIENT_ID
    ctpClientSecret = process.env.CTP_CLIENT_SECRET
    subscriptionOrderCreationUrl = process.env.SUBSCRIPTION_ORDER_CREATION_URL
    customHeaders = process.env.CUSTOM_HEADERS
    basicAuthUsername = process.env.BASIC_AUTH_USERNAME
    basicAuthPassword = process.env.BASIC_AUTH_PASSWORD
    process.env.CTP_PROJECT_KEY = 'project-key'
    process.env.CTP_CLIENT_ID = 'client_id'
    process.env.CTP_CLIENT_SECRET = 'client_secret'
    process.env.SUBSCRIPTION_ORDER_CREATION_URL =
      SUBSCRIPTION_ORDER_CREATION_URL
    process.env.CUSTOM_HEADERS = '{"Loyalty-Partner-Forward": 123}'
    process.env.BASIC_AUTH_USERNAME = 'username'
    process.env.BASIC_AUTH_PASSWORD = 'password'
  }

  function _restoreCtpEnvVars() {
    process.env.CTP_PROJECT_KEY = ctpProjectKey
    process.env.CTP_CLIENT_ID = ctpClientId
    process.env.CTP_CLIENT_SECRET = ctpClientSecret
    process.env.SUBSCRIPTION_ORDER_CREATION_URL = subscriptionOrderCreationUrl
    process.env.CUSTOM_HEADERS = customHeaders
    process.env.BASIC_AUTH_USERNAME = basicAuthUsername
    process.env.BASIC_AUTH_PASSWORD = basicAuthPassword
  }

  function _mockCtpOAuthEndpoint() {
    nock(CTP_AUTH_URL).persist().post('/oauth/token').reply(200, {
      access_token: 'hFuRNd4EjwTZOb2qUDqXxXrw0dMI-K-A',
      token_type: 'Bearer',
      scope: 'manage_project:project-id',
      expires_in: 172274,
    })
  }
})
