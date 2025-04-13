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

// Define calculator tool implementation
const calculatorTool: ToolImpl<{ expression: string }> = {
  name: 'calculate',
  description: 'Calculate the result of a mathematical expression',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate',
      },
    },
    required: ['expression'],
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Result: ${eval(args.expression)}`,
      },
    ],
    isError: false,
  }),
}

// Define time tool implementation
const timeTool: ToolImpl<{ timezone?: string }> = {
  name: 'get_time',
  description: 'Get the current time, optionally for a specific timezone',
  inputSchema: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'The timezone to get time for (optional)',
      },
    },
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Current time${args.timezone ? ` in ${args.timezone}` : ''}: ${new Date().toLocaleString()}`,
      },
    ],
    isError: false,
  }),
}

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
