#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Path to the README
const README_PATH = path.join(rootDir, 'README.md')

// Main function
function updateReadme() {
  console.log('🔄 Updating README.md with current file contents...')

  // Read the README
  let readme = fs.readFileSync(README_PATH, 'utf8')
  // Create a backup
  fs.writeFileSync(`${README_PATH}.bak`, readme, 'utf8')
  console.log(`📑 Created backup at ${README_PATH}.bak`)

  // Match any code block that starts with a file path comment
  const codeBlockRegex =
    /```(?:typescript|javascript)\s*\/\/\s*([^\s]+)[\s\S]*?```/g

  // Replace each matched code block with the contents of the referenced file
  readme = readme.replace(codeBlockRegex, (match, filePath) => {
    console.log(`🔍 Processing ${filePath}...`)

    // Get the full path to the file
    const fullPath = path.join(rootDir, filePath.trim())

    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ WARNING: File not found: ${fullPath}`)
      return match // Keep original if file not found
    }

    // Read the file content
    let fileContent = fs.readFileSync(fullPath, 'utf8')

    // Convert relative imports to package imports for examples
    if (filePath.includes('examples/')) {
      fileContent = fileContent.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/src\/index\.js['"]/g,
        "import { $1 } from 'mcp-express-adapter'",
      )
    }

    // Return the updated code block with the file path comment preserved
    return '```typescript\n// ' + filePath + '\n' + fileContent + '\n```'
  })

  // Write the updated README
  fs.writeFileSync(README_PATH, readme, 'utf8')
  console.log('✅ README.md updated successfully!')
}

// Run the script
updateReadme()
