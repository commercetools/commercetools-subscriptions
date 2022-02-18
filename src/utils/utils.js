import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'node:fs/promises'

async function readAndParseJsonFile (pathToJsonFileFromProjectRoot) {
  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDirPath = path.dirname(currentFilePath)
  const projectRoot = path.resolve(currentDirPath, '../..')
  const pathToFile = path.resolve(projectRoot, pathToJsonFileFromProjectRoot)
  const fileContent = await fs.readFile(pathToFile)
  return JSON.parse(fileContent)
}

export {
  readAndParseJsonFile
}
