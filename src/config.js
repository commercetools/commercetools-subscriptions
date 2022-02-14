import { fileURLToPath } from 'url'
import path from 'path'
import { promises as fs } from 'node:fs'
import rc from 'rc'

function getLogLevel () {
  return process.env.LOG_LEVEL || 'info'
}

async function getPackageJson () {
  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDirPath = path.dirname(currentFilePath)
  const pathToPackageJson = path.resolve(currentDirPath, '../package.json')
  const fileContent = await fs.readFile(pathToPackageJson)
  return JSON.parse(fileContent)
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
