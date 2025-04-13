import express, { Request, Response, Router } from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { Logger } from '../types.js'
import { z } from 'zod'

// Define a tool implementation that includes both the tool definition and its handler
export interface ToolImplementation {
  definition: Tool
  handler: (args: any) => Promise<any>
}

export interface MCPServerOptions {
  endpoint: string
  tools?: ToolImplementation[]
  serverName?: string
  serverVersion?: string
  logger?: Logger
}

const defaultLogger: Logger = {
  info: (...args: any[]) => console.error('[mcp-server]', ...args),
  error: (...args: any[]) => console.error('[mcp-server-error]', ...args),
}

export function MCPServer(options: MCPServerOptions): Router {
  const {
    endpoint,
    tools = [],
    serverName = 'mcp-server',
    serverVersion = '0.1.0',
    logger = defaultLogger,
  } = options

  // Normalize endpoint to ensure it starts with '/' and doesn't end with '/'
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`

  const finalEndpoint = normalizedEndpoint.endsWith('/')
    ? normalizedEndpoint.slice(0, -1)
    : normalizedEndpoint

  // Create SSE endpoint path and message endpoint path
  const ssePath = `${finalEndpoint}/sse`
  const messagePath = `${finalEndpoint}/message`

  const router = express.Router()

  // Create MCP server instance
  const server = new Server(
    { name: serverName, version: serverVersion },
    { capabilities: { tools: {}, prompts: {} } },
  )

  // Extract tool definitions only
  const toolDefinitions = tools.map((tool) => tool.definition)

  // Setup handlers

  // tools/list handler
  const ListToolsRequestSchema = z.object({
    method: z.literal('tools/list'),
  })
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Handling tools/list request')
    return { tools: toolDefinitions }
  })

  // prompts/list handler
  const PromptsListSchema = z.object({
    method: z.literal('prompts/list'),
  })
  server.setRequestHandler(PromptsListSchema, async () => {
    logger.info('Handling prompts/list request')
    return { prompts: [] }
  })

  // tools/call handler
  if (tools.length > 0) {
    const CallToolRequestSchema = z.object({
      method: z.literal('tools/call'),
      params: z.object({
        name: z.string(),
        arguments: z.record(z.any()),
      }),
    })

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name
      const toolArgs = request.params.arguments

      logger.info(`Handling tools/call for ${toolName}`)

      // Find the requested tool
      const toolImpl = tools.find((t) => t.definition.name === toolName)

      if (!toolImpl) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Unknown tool called: ${toolName}`,
            },
          ],
          isError: true,
        }
      }

      try {
        // Call the tool handler with the arguments
        return await toolImpl.handler(toolArgs)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Error processing tool call: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${toolName}: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  // SSE endpoint
  router.get(ssePath, async (req: Request, res: Response) => {
    logger.info(`New SSE connection from ${req.ip} on ${ssePath}`)

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Construct the message URL
    const host = req.headers.host || 'localhost:8000'
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const baseUrl = `${protocol}://${host}`
    const msgUrl = `${baseUrl}${messagePath}`

    logger.info(`Message URL: ${msgUrl}`)

    // Create SSE transport
    const transport = new SSEServerTransport(msgUrl, res)

    // Periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch (e) {
        clearInterval(pingInterval)
      }
    }, 20000)

    // Clean up on connection close
    req.on('close', () => {
      logger.info('SSE connection closed')
      clearInterval(pingInterval)
    })

    // Connect server to transport
    try {
      await server.connect(transport)
      logger.info('Server connected to SSE transport')
    } catch (err) {
      logger.error('Error connecting to transport:', err)
      res.status(500).end()
    }
  })

  // Message endpoint
  router.post(
    messagePath,
    express.raw({ type: '*/*' }),
    (req: Request, res: Response) => {
      // Get the query parameter
      const sessionId = req.query.sessionId as string
      if (!sessionId) {
        res.status(400).send('Missing sessionId parameter')
        return
      }

      logger.info(`Received message for session: ${sessionId}`)

      // Forward to the SSE server - it will handle the sessionId
      res.status(200).send('OK')
    },
  )

  return router
}
