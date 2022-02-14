import { fileURLToPath } from 'url'
import path from 'path'
import { promises as fs } from 'node:fs'

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
  return {
    ctpConcurrency: parseInt(process.env.CTP_CONCURRENCY, 10) || 10,
    sftpConcurrency: parseInt(process.env.SFTP_CONCURRENCY, 10) || 5,
  }
}

function getClientConfig () {
  return {
    projectKey: process.env.CTP_PROJECT_KEY,
    clientId: process.env.CTP_CLIENT_ID,
    clientSecret: process.env.CTP_CLIENT_SECRET,
    apiUrl:
      process.env.CTP_API_URL
      || 'https://api.europe-west1.gcp.commercetools.com',
    authUrl:
      process.env.CTP_AUTH_URL
      || 'https://auth.europe-west1.gcp.commercetools.com',
  }
}

export {
  getLogLevel, getPackageJson, getConcurrency, getClientConfig
}
