#!/usr/bin/env node
import express from 'express'
import cors from 'cors'
import { MCPClient, ToolImpl } from '../lib/mcp-client.js'

// Parse command line arguments
const args = process.argv.slice(2)
let PORT = 8000

// Check for port argument
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10)
    console.log(`Using port: ${PORT}`)
    break
  }
}

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
  handler: async (args: { location: string }) => ({
    content: [
      {
        type: 'text',
        text: `Weather for ${args.location}: Sunny, 72°F`,
      },
    ],
    isError: false,
  }),
}

// Define search tool implementation
const searchTool: ToolImpl<{ query: string }> = {
  name: 'search_web',
  description: 'Search the web for information',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
    },
    required: ['query'],
  },
  handler: async (args: { query: string }) => ({
    content: [
      {
        type: 'text',
        text: `Search results for "${args.query}": Here are some relevant results...`,
      },
    ],
    isError: false,
  }),
}

// Define image tool implementation
const imageTool: ToolImpl<{ prompt: string }> = {
  name: 'create_image',
  description: 'Create an image from a description',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Image description',
      },
    },
    required: ['prompt'],
  },
  handler: async (args: { prompt: string }) => ({
    content: [
      {
        type: 'text',
        text: `Created image from prompt: "${args.prompt}"`,
      },
    ],
    isError: false,
  }),
}

// Set up MCP Clients for different endpoints
const agent1 = new MCPClient({
  endpoint: '/agent-1',
  tools: [weatherTool, searchTool],
  serverName: 'mcp-server-agent-1',
  serverVersion: '1.0.0',
})

const agent2 = new MCPClient({
  endpoint: '/agent-2',
  tools: [imageTool],
  serverName: 'mcp-server-agent-2',
  serverVersion: '1.0.0',
})

// Mount agent routers BEFORE the global JSON parser
app.use('/agent-1', agent1.middleware())
app.use('/agent-2', agent2.middleware())

// Apply global JSON parser AFTER agent routes
app.use(express.json())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.send('ok')
})

// Start the server
try {
  app.listen(PORT, () => {
    console.log(`MCP Server running on port ${PORT}`)
    console.log(`Try our express-mcp client to connect:`)
    console.log(`- express-mcp --host http://localhost:${PORT}/agent-1`)
    console.log(`- express-mcp --host http://localhost:${PORT}/agent-2`)
    console.log('\nOr use our test command:')
    console.log(`curl -N http://localhost:${PORT}/agent-1/sse`)
  })
} catch (error) {
  console.error(`Failed to start server on port ${PORT}:`, error)
  process.exit(1)
}
