import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'node:fs/promises'
import VError from 'verror'

async function readAndParseJsonFile(pathToJsonFileFromProjectRoot) {
  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDirPath = path.dirname(currentFilePath)
  const projectRoot = path.resolve(currentDirPath, '../..')
  const pathToFile = path.resolve(projectRoot, pathToJsonFileFromProjectRoot)
  const fileContent = await fs.readFile(pathToFile)
  return JSON.parse(fileContent)
}

async function updateOrderWithRetry(
  apiRoot,
  orderId,
  updateActions,
  version,
  orderNumber = orderId
) {
  let retryCount = 0
  const maxRetry = 20
  // eslint-disable-next-line no-constant-condition
  while (true)
    try {
      await apiRoot
        .orders()
        .withId({ ID: orderId })
        .post({
          body: {
            actions: updateActions,
            version,
          },
        })
        .execute()
      break
    } catch (err) {
      if (err.statusCode === 409) {
        retryCount += 1
        const { currentVersion } = err.body.errors[0]
        if (retryCount > maxRetry) {
          const retryMessage =
            'Got a concurrent modification error' +
            ` when updating template order with number or ID "${orderNumber}".` +
            ` Version tried "${version}",` +
            ` currentVersion: "${currentVersion}".`
          throw new VError(
            err,
            `${retryMessage} Won't retry again` +
              ` because of a reached limit ${maxRetry}` +
              ' max retries.'
          )
        }
        version = currentVersion
      } else throw err
    }
}

export { readAndParseJsonFile, updateOrderWithRetry }
