import { createClient } from '@commercetools/sdk-client'
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth'
import { createUserAgentMiddleware } from '@commercetools/sdk-middleware-user-agent'
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http'
import { createQueueMiddleware } from '@commercetools/sdk-middleware-queue'
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk'
import { createRequestBuilder } from '@commercetools/api-request-builder'
import fetch from 'isomorphic-fetch'
import _ from 'lodash'
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

  const httpMiddleware = createHttpMiddleware({
    maskSensitiveHeaderData: true,
    host: apiUrl,
    enableRetry: true,
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
