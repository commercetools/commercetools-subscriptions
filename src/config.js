import rc from 'rc'
import { readAndParseJsonFile } from './utils/utils.js'

function getLogLevel () {
  return process.env.LOG_LEVEL || 'info'
}

async function getPackageJson () {
  return readAndParseJsonFile('./package.json')
}

function getConcurrency () {
  const config = loadConfigFromFile()
  return {
    ctpConcurrency: parseInt(process.env.CTP_CONCURRENCY || config.ctpConcurrency, 10) || 10
  }
}

function getClientConfig () {
  const config = loadConfigFromFile()
  return {
    projectKey: process.env.CTP_PROJECT_KEY || config.ctpProjectKey,
    clientId: process.env.CTP_CLIENT_ID || config.ctpClientId,
    clientSecret: process.env.CTP_CLIENT_SECRET || config.ctpClientSecret,
    apiUrl:
      (process.env.CTP_API_URL || config.ctpApiUrl)
      || 'https://api.europe-west1.gcp.commercetools.com',
    authUrl:
      (process.env.CTP_AUTH_URL || config.ctpAuthUrl)
      || 'https://auth.europe-west1.gcp.commercetools.com',
  }
}

let config
let isFileLoaded

function loadConfigFromFile () {
  if (!isFileLoaded) {
    /*
    see: https://github.com/dominictarr/rc#standards for file precedence.
     */
    const appName = 'subscriptions'
    config = rc(appName)
    isFileLoaded = true
  }
  return config
}

export {
  getLogLevel, getPackageJson, getConcurrency, getClientConfig
}
