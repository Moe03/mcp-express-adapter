import express from 'express'
import cors from 'cors'
import { MCPClient, ToolImpl } from 'mcp-express-middleware'

// Create Express app
const app = express()
app.use(cors())

// Define weather tool implementation
const weatherTool: ToolImpl<{ location: string }> = {
  name: 'get_weather',
  description: 'Get the current weather for a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The location to get weather for',
      },
    },
    required: ['location'],
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Weather for ${args.location}: Sunny, 72°F`,
      },
    ],
    isError: false,
  }),
}

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool],
  serverName: 'my-mcp-server',
  serverVersion: '1.0.0',
})

// Mount MCP router BEFORE global JSON parser
app.use('/mcp', mcpClient.middleware())

// Apply global JSON parser AFTER agent routes
app.use(express.json())

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
  console.log(`Connect at: http://localhost:${PORT}/mcp/sse`)
})
