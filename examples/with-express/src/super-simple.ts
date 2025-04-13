import express from 'express'
import cors from 'cors'
import { MCPClient, mcpTool } from '../../../src/index.js'
import { z } from 'zod'

// Create Express app
const app = express()
app.use(cors())

// Define a super simple weather tool
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  // Define input schema
  schema: z.object({
    location: z.string().describe('The city to get weather for'),
  }),
  // No output schema needed for simple string responses
  handler: async (args) => {
    // Just return a string - mcpTool handles the formatting
    return `Weather for ${args.location}: ☀️ Sunny and 72°F`
  },
})

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool],
  serverName: 'demo-server',
  serverVersion: '1.0.0',
})

// Mount MCP router
app.use('/mcp', mcpClient.middleware())

// Apply JSON parser for other routes
app.use(express.json())

// Start the server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✨ Super Simple MCP Server running!`)
  console.log(`🔗 Connect at: http://localhost:${PORT}/mcp/sse`)
})
