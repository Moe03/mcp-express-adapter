import express from 'express'
import cors from 'cors'
import { MCPClient, mcpTool } from 'mcp-express-adapter'
import { z } from 'zod'

// Create Express app
const app = express()
app.use(cors())

// Define weather tool using mcpTool helper
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  schema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  handler: async (args) => {
    return `Weather for ${args.location}: Sunny, 72°F`
  },
})

// Define calculator tool using mcpTool helper
const calculatorTool = mcpTool({
  name: 'calculate',
  description: 'Calculate the result of a mathematical expression',
  schema: z.object({
    expression: z.string().describe('The mathematical expression to evaluate'),
  }),
  handler: async (args) => {
    return `Result: ${eval(args.expression)}`
  },
})

// Define time tool using mcpTool helper
const timeTool = mcpTool({
  name: 'get_time',
  description: 'Get the current time, optionally for a specific timezone',
  schema: z.object({
    timezone: z
      .string()
      .optional()
      .describe('The timezone to get time for (optional)'),
  }),
  handler: async (args) => {
    return `Current time${args.timezone ? ` in ${args.timezone}` : ''}: ${new Date().toLocaleString()}`
  },
})

// Create first MCP client with weather tool
const weatherClient = new MCPClient({
  endpoint: '/weather-mcp',
  tools: [weatherTool],
  serverName: 'weather-mcp-server',
  serverVersion: '1.0.0',
})

// Create second MCP client with calculator tool
const calculatorClient = new MCPClient({
  endpoint: '/calculator-mcp',
  tools: [calculatorTool],
  serverName: 'calculator-mcp-server',
  serverVersion: '1.0.0',
})

// Create third MCP client with time tool
const timeClient = new MCPClient({
  endpoint: '/time-mcp',
  tools: [timeTool],
  serverName: 'time-mcp-server',
  serverVersion: '1.0.0',
})

// Mount MCP routers BEFORE global JSON parser
app.use('/weather-mcp', weatherClient.middleware())
app.use('/calculator-mcp', calculatorClient.middleware())
app.use('/time-mcp', timeClient.middleware())

// Apply global JSON parser AFTER agent routes
app.use(express.json())

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  console.log(`Multiple MCP Servers running on port ${PORT}`)
  console.log(`Weather MCP: http://localhost:${PORT}/weather-mcp/sse`)
  console.log(`Calculator MCP: http://localhost:${PORT}/calculator-mcp/sse`)
  console.log(`Time MCP: http://localhost:${PORT}/time-mcp/sse`)
})
