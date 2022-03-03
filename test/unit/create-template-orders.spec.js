import nock from 'nock'
import { expect } from 'chai'
import { createTemplateOrders } from '../../src/create-template-orders.js'
import { readAndParseJsonFile } from '../../src/utils/utils.js'

const lastStartTstpResponse = await readAndParseJsonFile(
  'test/unit/mocks/subscriptions-lastStartTimestamp-response.json'
)
const checkoutOrderResponse = await readAndParseJsonFile(
  'test/unit/mocks/checkout-order-response.json'
)
const paymentResponse = await readAndParseJsonFile(
  'test/unit/mocks/payment-response.json'
)

const orderCreateDuplicateErrorResponse = await readAndParseJsonFile(
  'test/unit/mocks/order-create-duplicate-error-response.json'
)

describe('create-template-orders', () => {
  let ctpProjectKey
  let ctpClientId
  let ctpClientSecret
  const CTP_API_URL = 'https://api.europe-west1.gcp.commercetools.com'
  const CTP_AUTH_URL = 'https://auth.europe-west1.gcp.commercetools.com'

  before(() => {
    _mockCtpOAuthEndpoint()
    _mockCtpEnvVars()
  })

  after(() => {
    _restoreCtpEnvVars()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('when error is 400 duplicated error, order creation is skipped', async () => {
    nock(CTP_API_URL)
      .get(
        '/project-key/custom-objects/commercetools-subscriptions/subscriptions-lastStartTimestamp'
      )
      .reply(200, lastStartTstpResponse)

    nock(CTP_API_URL)
      .get('/project-key/orders')
      .query(
        (actualQueryObject) =>
          actualQueryObject.where ===
          // eslint-disable-next-line max-len
          'createdAt > "2022-03-02T17:20:43.250Z" AND custom(fields(hasSubscription=true)) AND custom(fields(isSubscriptionProcessed is not defined))'
      )
      .reply(200, checkoutOrderResponse)

    nock(CTP_API_URL)
      .post(
        '/project-key/payments',
        (body) => body.paymentMethodInfo.paymentInterface
      )
      .reply(200, paymentResponse)

    nock(CTP_API_URL)
      .post('/project-key/orders/import')
      .reply(400, orderCreateDuplicateErrorResponse)

    nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        '/project-key/orders/12d7c490-a792-4abe-9a35-cdf9b113a11f',
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

    nock(CTP_API_URL)
      // eslint-disable-next-line max-len
      .post(
        '/project-key/custom-objects',
        (body) =>
          body.container === 'commercetools-subscriptions' &&
          body.key === 'subscriptions-lastStartTimestamp'
      )
      .reply(200)

    const stats = await createTemplateOrders(new Date())

    expect(stats).to.deep.equal({
      processedCheckoutOrders: 1,
      createdTemplateOrders: 0,
      failedCheckoutOrders: 0,
      duplicatedTemplateOrderCreation: 1,
    })
  })

  it('when error is 400 bad request error, log it and skip creation', () => {})

  it('when error is 500 error, retry and fail the job when try limit is fetched', () => {})

  function _mockCtpOAuthEndpoint() {
    nock(CTP_AUTH_URL).persist().post('/oauth/token').reply(200, {
      access_token: 'hFuRNd3EjwUZOb1qUDqNtlrw0dMI-K-A',
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
})
