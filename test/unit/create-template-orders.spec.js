import nock from 'nock'
import { expect } from 'chai'
import { createTemplateOrders } from '../../src/create-template-orders.js'
import { readAndParseJsonFile } from '../../src/utils/utils.js'
import getLogger from '../../src/utils/logger.js'

const lastStartTstpResponse = await readAndParseJsonFile(
  'test/unit/mocks/subscriptions-lastStartTimestamp-response.json'
)
const checkoutOrderResponse = await readAndParseJsonFile(
  'test/unit/mocks/checkout-order-response.json'
)
const templateOrderResponse = await readAndParseJsonFile(
  'test/unit/mocks/template-order-response.json'
)
const paymentResponse = await readAndParseJsonFile(
  'test/unit/mocks/payment-response.json'
)
const orderCreateDuplicateErrorResponse = await readAndParseJsonFile(
  'test/unit/mocks/order-create-duplicate-error-response.json'
)
const badRequestErrorResponse = await readAndParseJsonFile(
  'test/unit/mocks/bad-request-error-response.json'
)

describe('create-template-orders', () => {
  let ctpProjectKey
  let ctpClientId
  let ctpClientSecret
  let logger
  let apiRoot
  let ctpClient
  const CTP_API_URL = 'https://api.europe-west1.gcp.commercetools.com'
  const CTP_AUTH_URL = 'https://auth.europe-west1.gcp.commercetools.com'
  const PROJECT_KEY = 'project-key'
  const TEMPLATE_ORDER_ID = '99267ba2-1d6c-4a03-8771-df2d9524f9b8'
  const CHECKOUT_ORDER_ID = '12d7c490-a792-4abe-9a35-cdf9b113a11f'

  before(async () => {
    _mockCtpEnvVars()
    const { getApiRoot, getCtpClient } = await import(
      // eslint-disable-next-line import/no-unresolved
      '../../src/utils/client.js?testName=create-template-orders'
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

  it('when error is 400 duplicated error, order creation is skipped', async () => {
    _mockCommonRequestsAndResponse()

    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/orders/import`)
      .reply(400, orderCreateDuplicateErrorResponse)

    const setIsSubscriptionProcessed = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/orders/${CHECKOUT_ORDER_ID}`,
        (body) =>
          JSON.stringify(body) ===
          JSON.stringify({
            actions: [
              {
                action: 'setCustomField',
                name: 'isSubscriptionProcessed',
                value: true,
              },
            ],
            version: 3,
          })
      )
      .reply(200)

    const updateLastStartTimestamp = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/custom-objects`,
        (body) =>
          body.container === 'commercetools-subscriptions' &&
          body.key === 'subscriptions-lastStartTimestamp'
      )
      .reply(200)

    const stats = await createTemplateOrders({
      ctpClient,
      apiRoot,
      logger,
      startDate: new Date(),
    })

    expect(stats).to.deep.equal({
      processedCheckoutOrders: 1,
      createdTemplateOrders: 0,
      failedCheckoutOrders: 0,
      duplicatedTemplateOrderCreation: 1,
    })
    expect(setIsSubscriptionProcessed.isDone()).to.be.true
    expect(updateLastStartTimestamp.isDone()).to.be.true
  })

  it('when error is 400 bad request error, log it and skip creation', async () => {
    _mockCommonRequestsAndResponse()

    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/orders/import`)
      .reply(400, badRequestErrorResponse)

    const setIsSubscriptionProcessed = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/orders/${CHECKOUT_ORDER_ID}`,
        (body) =>
          JSON.stringify(body) ===
          JSON.stringify({
            actions: [
              {
                action: 'setCustomField',
                name: 'isSubscriptionProcessed',
                value: true,
              },
            ],
            version: 3,
          })
      )
      .reply(200)

    const updateLastStartTimestamp = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/custom-objects`,
        (body) =>
          body.container === 'commercetools-subscriptions' &&
          body.key === 'subscriptions-lastStartTimestamp'
      )
      .reply(200)

    const stats = await createTemplateOrders({
      ctpClient,
      apiRoot,
      logger,
      startDate: new Date(),
    })

    expect(stats).to.deep.equal({
      processedCheckoutOrders: 1,
      createdTemplateOrders: 0,
      failedCheckoutOrders: 1,
      duplicatedTemplateOrderCreation: 0,
    })
    expect(setIsSubscriptionProcessed.isDone()).to.be.false
    expect(updateLastStartTimestamp.isDone()).to.be.true
  })

  it('when error is 409, retry with new version', async () => {
    _mockCommonRequestsAndResponse()

    nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/orders/import`)
      .reply(200, templateOrderResponse)

    const addPaymentToTemplateOrder = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(`/${PROJECT_KEY}/orders/${TEMPLATE_ORDER_ID}`, (body) =>
        body.actions.some((action) => action.action === 'addPayment')
      )
      .reply(409, {
        statusCode: 409,
        message: 'Version mismatch. Concurrent modification.',
        errors: [
          {
            code: 'ConcurrentModification',
            message: 'Version mismatch. Concurrent modification.',
            currentVersion: 3,
          },
        ],
      })
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/orders/${TEMPLATE_ORDER_ID}`,
        (body) =>
          body.actions.some((action) => action.action === 'addPayment') &&
          body.version === 3
      )
      .reply(200)

    const setIsSubscriptionProcessed = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/orders/${CHECKOUT_ORDER_ID}`,
        (body) =>
          JSON.stringify(body) ===
          JSON.stringify({
            actions: [
              {
                action: 'setCustomField',
                name: 'isSubscriptionProcessed',
                value: true,
              },
            ],
            version: 3,
          })
      )
      .reply(200)

    const updateLastStartTimestamp = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/custom-objects`,
        (body) =>
          body.container === 'commercetools-subscriptions' &&
          body.key === 'subscriptions-lastStartTimestamp'
      )
      .reply(200)

    const stats = await createTemplateOrders({
      ctpClient,
      apiRoot,
      logger,
      startDate: new Date(),
    })

    expect(stats).to.deep.equal({
      processedCheckoutOrders: 1,
      createdTemplateOrders: 1,
      failedCheckoutOrders: 0,
      duplicatedTemplateOrderCreation: 0,
    })
    expect(addPaymentToTemplateOrder.isDone()).to.be.true
    expect(setIsSubscriptionProcessed.isDone()).to.be.true
    expect(updateLastStartTimestamp.isDone()).to.be.true
  })

  it('when error is 500 error, retry and fail the job when retry limit is fetched', async () => {
    _mockCommonRequestsAndResponse()

    const createNewOrder = nock(CTP_API_URL)
      .post(`/${PROJECT_KEY}/orders/import`)
      .times(10)
      .reply(500, {
        message:
          '"Client network socket disconnected before secure TLS connection was established"',
      })

    const setIsSubscriptionProcessed = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/orders/${CHECKOUT_ORDER_ID}`,
        (body) =>
          JSON.stringify(body) ===
          JSON.stringify({
            actions: [
              {
                action: 'setCustomField',
                name: 'isSubscriptionProcessed',
                value: true,
              },
            ],
            version: 3,
          })
      )
      .reply(200)

    const updateLastStartTimestamp = nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        `/${PROJECT_KEY}/custom-objects`,
        (body) =>
          body.container === 'commercetools-subscriptions' &&
          body.key === 'subscriptions-lastStartTimestamp'
      )
      .reply(200)

    const stats = await createTemplateOrders({
      ctpClient,
      apiRoot,
      logger,
      startDate: new Date(),
    })

    expect(stats).to.deep.equal({
      processedCheckoutOrders: 1,
      createdTemplateOrders: 0,
      failedCheckoutOrders: 1,
      duplicatedTemplateOrderCreation: 0,
    })
    expect(createNewOrder.isDone()).to.be.true
    expect(setIsSubscriptionProcessed.isDone()).to.be.false
    expect(updateLastStartTimestamp.isDone()).to.be.false
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

  function _mockCommonRequestsAndResponse() {
    nock(CTP_API_URL)
      .get(
        `/${PROJECT_KEY}/custom-objects/commercetools-subscriptions/subscriptions-lastStartTimestamp`
      )
      .reply(200, lastStartTstpResponse)

    nock(CTP_API_URL)
      .get(`/${PROJECT_KEY}/orders`)
      .query(
        (actualQueryObject) =>
          actualQueryObject.where ===
          // eslint-disable-next-line max-len
          'createdAt > "2022-03-02T17:20:43.250Z" AND custom(fields(hasSubscription=true)) AND custom(fields(isSubscriptionProcessed is not defined))'
      )
      .reply(200, checkoutOrderResponse)

    nock(CTP_API_URL)
      .post(
        `/${PROJECT_KEY}/payments`,
        (body) => body.paymentMethodInfo.paymentInterface
      )
      .reply(200, paymentResponse)
  }

  function _restoreCtpEnvVars() {
    process.env.CTP_PROJECT_KEY = ctpProjectKey
    process.env.CTP_CLIENT_ID = ctpClientId
    process.env.CTP_CLIENT_SECRET = ctpClientSecret
  }
})
