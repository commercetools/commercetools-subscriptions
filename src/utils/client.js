import { createClient } from '@commercetools/sdk-client'
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth'
import { createUserAgentMiddleware } from '@commercetools/sdk-middleware-user-agent'
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http'
import { createQueueMiddleware } from '@commercetools/sdk-middleware-queue'
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk'
import fetch from 'isomorphic-fetch'
import { getClientConfig, getConcurrency, getPackageJson } from '../config.js'

const packageJson = await getPackageJson()

function createCtpClient ({
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
export default function getApiRoot () {
  if (apiRoot) return apiRoot

  const clientConfig = getClientConfig()
  const ctpClient = createCtpClient(clientConfig)
  apiRoot = createApiBuilderFromCtpClient(ctpClient).withProjectKey({
    projectKey: clientConfig.projectKey,
  })
  return apiRoot
}
