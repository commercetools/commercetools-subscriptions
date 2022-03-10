import { createClient } from '@commercetools/sdk-client'
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth'
import { createUserAgentMiddleware } from '@commercetools/sdk-middleware-user-agent'
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http'
import { createQueueMiddleware } from '@commercetools/sdk-middleware-queue'
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk'
import { createRequestBuilder } from '@commercetools/api-request-builder'
import fetch from 'isomorphic-fetch'
import _ from 'lodash'
import util from 'util'
import { getClientConfig, getConcurrency, getPackageJson } from '../config.js'

const packageJson = await getPackageJson()

function createCtpClient({
  clientId,
  clientSecret,
  projectKey,
  authUrl,
  apiUrl,
}) {
  const authMiddleware = createAuthMiddlewareForClientCredentialsFlow({
    host: authUrl,
    projectKey,
    credentials: {
      clientId,
      clientSecret,
    },
    fetch,
  })

  const userAgentMiddleware = createUserAgentMiddleware({
    libraryName: packageJson.name,
    libraryVersion: packageJson.version,
    contactUrl: packageJson.homepage,
    contactEmail: packageJson.author.email,
  })

  const arrayFrom500To509 = Array.from({ length: 100 }, (ignore, i) => i + 500)
  const httpMiddleware = createHttpMiddleware({
    maskSensitiveHeaderData: true,
    host: apiUrl,
    enableRetry: true,
    retryConfig: {
      retryCodes: arrayFrom500To509,
    },
    fetch,
  })

  const queueMiddleware = createQueueMiddleware({
    concurrency: getConcurrency().ctpConcurrency,
  })

  return createClient({
    middlewares: [
      authMiddleware,
      userAgentMiddleware,
      httpMiddleware,
      queueMiddleware,
    ],
  })
}

let apiRoot
let ctpClient

function getRequestBuilder(projectKey) {
  return createRequestBuilder({ projectKey })
}

function getCtpClient() {
  if (ctpClient) return ctpClient
  const clientConfig = getClientConfig()
  const customMethods = {
    get builder() {
      return getRequestBuilder(clientConfig.projectKey)
    },

    fetchBatches(uri, callback, opts = { accumulate: false }) {
      return this.process(
        this.buildRequestOptions(uri.build()),
        (data) => Promise.resolve(callback(data.body.results)),
        opts
      )
    },

    async *fetchPagesGraphQl({ queryBody, variables, endpoint }) {
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

        const data = await this.queryGraphQl(queryBody, variables)

        if (_.get(data, 'body.errors.length')) {
          const e = { queryBody, variables, errors: data }
          throw new Error(
            util.inspect(e, { showHidden: true, depth: null, colors: true })
          )
        }
        const { results } = data.body.data[endpoint]

        yield results

        // Due to performance best practice we do not rely on total count.
        // As a consequence, in case last page results length is the same as
        // the limit we will do 1 obsolete request with 0 results.
        if (!results.length || results.length < variables.limit) break

        lastId = _.last(results).id
      }
    },

    async queryGraphQl(query, variables) {
      const reqOptions = this.buildRequestOptions(
        `/${clientConfig.projectKey}/graphql`,
        'POST',
        { query, variables }
      )

      return ctpClient.execute(reqOptions)
    },

    buildRequestOptions(uri, method = 'GET', body = undefined) {
      return {
        uri,
        method,
        body,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    },
  }
  ctpClient = _.merge(customMethods, createCtpClient(clientConfig))
  return ctpClient
}

function getApiRoot() {
  if (apiRoot) return apiRoot

  const clientConfig = getClientConfig()
  const _ctpClient = getCtpClient()
  apiRoot = createApiBuilderFromCtpClient(_ctpClient).withProjectKey({
    projectKey: clientConfig.projectKey,
  })
  return apiRoot
}

export { getApiRoot, getCtpClient }
