import fetch from 'isomorphic-fetch'
import _ from 'lodash'
import { ClientBuilder } from '@commercetools/sdk-client-v2'
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk'
import { getClientConfig, getConcurrency, getPackageJson } from '../config.js'

const packageJson = await getPackageJson()

function createCtpClient({
  clientId,
  clientSecret,
  projectKey,
  authUrl,
  apiUrl,
}) {
  return new ClientBuilder()
    .withClientCredentialsFlow({
      host: authUrl,
      projectKey,
      credentials: {
        clientId,
        clientSecret,
      },
      fetch,
    })
    .withHttpMiddleware({
      maskSensitiveHeaderData: true,
      host: apiUrl,
      enableRetry: true,
      retryConfig: {
        retryCodes: [500, 502, 503, 504],
      },
      fetch,
    })
    .withQueueMiddleware({ concurrency: getConcurrency().ctpConcurrency })
    .withUserAgentMiddleware({
      libraryName: packageJson.name,
      libraryVersion: packageJson.version,
      contactUrl: packageJson.homepage,
      contactEmail: packageJson.author.email,
    })
    .build()
}

let apiRoot
let ctpClient

function getApiRoot() {
  if (apiRoot) return apiRoot

  const clientConfig = getClientConfig()
  apiRoot = createApiBuilderFromCtpClient(getCtpClient()).withProjectKey({
    projectKey: clientConfig.projectKey,
  })
  apiRoot.fetchBatches = _fetchBatches
  apiRoot.fetchPagesGraphQl = _fetchPagesGraphQl
  return apiRoot
}

function getCtpClient() {
  if (ctpClient) return ctpClient

  const clientConfig = getClientConfig()
  ctpClient = createCtpClient(clientConfig)
  return ctpClient
}

/**
 * Fetch resources (e.g: orders) by iterating over all the pages, increasing the page number after each iteration.
 *
 * const { request } = apiRoot.orders().get({
 *   queryArgs: {
 *     where: 'custom(fields(hasSubscription=true))',
 *     expand: ['paymentInfo.payments[*]'],
 *   },
 * })
 * await apiRoot.fetchBatches(request, async (orders) => {
 *    // do sth with the orders page
 * }
 */
function _fetchBatches(request, callback, opts = { accumulate: false }) {
  return ctpClient.process(
    request,
    (data) => Promise.resolve(callback(data.body.results)),
    opts
  )
}

/**
 * Fetch graphql projections by iterating over all the pages, increasing the page number after each iteration.
 *
 * This is a generator function and can be used in a for loop like in the next example:
 *
 * const orderQuery = {
 *    queryBody: graphqlQuery,
 *    variables: { where: `custom(fields(nextDeliveryDate <= "${now}"` },
 *    endpoint: 'orders'
 * }
 * for await (const templateOrders of apiRoot.fetchPagesGraphQl(orderQuery))
 *    // do sth with the orders page
 * }
 */
async function* _fetchPagesGraphQl({ queryBody, variables, endpoint }) {
  const originalWhere = variables.where
  // ensure limit is always set since it helps to avoid last/obsolete request
  if (!variables.limit) variables.limit = 20

  let lastId = null

  // to ensure we do not fetch duplicate results we have to sort by id only
  variables.sort = ['id asc']

  while (true) {
    const where = [lastId ? `id > "${lastId}"` : null, originalWhere]
      .filter(Boolean)
      .join(' AND ')

    if (where) variables.where = where

    const data = await apiRoot
      .graphql()
      .post({ body: { query: queryBody, variables } })
      .execute()

    const { results } = data.body.data[endpoint]

    yield results

    // Due to performance best practce we do not rely on total count.
    // As a consequence, in case last page results length is the same as
    // the limit we will do 1 obsolete request with 0 results.
    if (!results.length || results.length < variables.limit) break

    lastId = _.last(results).id
  }
}

export { getApiRoot }
