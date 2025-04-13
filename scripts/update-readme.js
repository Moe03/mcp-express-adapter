#!/usr/bin/env node

/**
 * This script automatically updates the README.md file by replacing
 * code blocks that start with a file path comment.
 *
 * Example:
 * ```typescript
 * // examples/with-express/src/index.ts
 * ```
 *
 * The script will replace the entire code block with the content of the referenced file.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const rootDir = path.resolve(__dirname, '..')
const readmePath = path.join(rootDir, 'README.md')

/**
 * Replaces code blocks that start with a file path comment with the contents of those files
 */
function updateReadme() {
  if (!fs.existsSync(readmePath)) {
    console.error(`README file not found: ${readmePath}`)
    process.exit(1)
  }

  // Read the current README
  let readme = fs.readFileSync(readmePath, 'utf8')

  // This regex matches:
  // 1. A code block opening (```typescript or ```javascript)
  // 2. A comment with a file path (// path/to/file.ts)
  // 3. Captures everything until the closing code block
  const codeBlockPattern =
    /(```(?:typescript|javascript)\s*\/\/\s*([^\s]+).*?)```/gs

  // Replace each matched code block with the contents of the referenced file
  readme = readme.replace(
    codeBlockPattern,
    (match, codeBlockStart, filePath, offset, string) => {
      // Extract the language from the opening
      const language = codeBlockStart.trim().startsWith('```typescript')
        ? 'typescript'
        : 'javascript'

      // Get the full path to the referenced file
      const fullPath = path.join(rootDir, filePath.trim())

      if (!fs.existsSync(fullPath)) {
        console.error(`Referenced file not found: ${fullPath}`)
        return match // Keep the original text if the file is not found
      }

      // Read the file content
      let fileContent = fs.readFileSync(fullPath, 'utf8')

      // For examples, convert relative imports to package imports
      if (filePath.includes('examples/')) {
        fileContent = fileContent.replace(
          /import\s*{([^}]+)}\s*from\s*['"]\.\.\/\.\.\/\.\.\/src\/.*['"]/g,
          (match, imports) => {
            return `import { ${imports} } from 'mcp-express-adapter'`
          },
        )
      }

      // Return the updated code block with the original file path comment preserved
      return `\`\`\`${language}\n// ${filePath}\n${fileContent}\n\`\`\``
    },
  )

  // Write the updated README back to disk
  fs.writeFileSync(readmePath, readme, 'utf8')
  console.log('README.md updated successfully with referenced file contents.')
}

// Run the update function
try {
  updateReadme()
} catch (error) {
  console.error('Error updating README:', error)
  process.exit(1)
}
