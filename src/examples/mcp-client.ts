import {
  Router,
  Request,
  Response,
  RequestHandler,
  NextFunction,
  raw as expressRaw, // Import raw body parser
} from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { Tool, ToolSchema } from '@modelcontextprotocol/sdk/types.js' // Import ToolSchema
import { z } from 'zod'
import express from 'express'

/**
 * MCPClient tool implementation type
 */
export interface ToolImpl<T = any> {
  name: string
  description: string
  // Use the correct SDK key: inputSchema (camelCase)
  inputSchema: Tool['inputSchema']
  handler: (args: T) => Promise<{
    content: Array<
      | { type: string; text?: string }
      | { type: string; data?: string; mimeType?: string }
    >
    isError?: boolean
  }>
}

/**
 * MCPClient options
 */
export interface MCPClientOptions {
  endpoint: string // Make endpoint required for clarity
  tools: ToolImpl[]
  serverName?: string
  serverVersion?: string
}

/**
 * MCPClient class using the MCP SDK Server for handling protocol in Express
 */
export class MCPClient {
  private router: Router
  private endpoint: string
  private server: Server // Use the SDK Server
  private ssePath: string
  private messagePath: string
  private toolDefinitionsMap: Record<string, Tool> // Map tool name to Tool definition

  // Store active transports by sessionId
  private activeTransports: Record<string, SSEServerTransport> = {}

  /**
   * Create a new MCPClient instance
   */
  constructor(options: MCPClientOptions) {
    this.router = Router()
    this.endpoint = options.endpoint.startsWith('/')
      ? options.endpoint
      : `/${options.endpoint}`
    this.endpoint = this.endpoint.endsWith('/')
      ? this.endpoint.slice(0, -1)
      : this.endpoint // Normalize

    // Define paths RELATIVE to the endpoint mount point
    this.ssePath = '/sse'
    this.messagePath = '/message'

    const serverName = options.serverName || 'mcp-server'
    const serverVersion = options.serverVersion || '1.0.0'

    // Create and validate tool definitions using the SDK schema
    this.toolDefinitionsMap = {} // This still stores the full Tool objects
    const capabilitiesToolsMap: Record<string, Omit<Tool, 'name'>> = {} // This map is for capabilities

    options.tools.forEach((impl) => {
      const toolDefinition: Omit<Tool, 'inputSchema'> & { inputSchema: any } = {
        name: impl.name,
        description: impl.description,
        inputSchema: impl.inputSchema || { type: 'object', properties: {} },
      }

      try {
        const validatedTool = ToolSchema.parse(toolDefinition)
        this.toolDefinitionsMap[impl.name] = validatedTool
        // Populate the capabilities map correctly
        capabilitiesToolsMap[validatedTool.name] = {
          description: validatedTool.description,
          inputSchema: validatedTool.inputSchema,
        }
      } catch (e) {
        console.error(
          `[MCPClient] Invalid tool definition for "${impl.name}":`,
          (e as Error).message,
        )
      }
    })

    // Create the SDK Server instance with the correctly structured capabilities map
    this.server = new Server(
      { name: serverName, version: serverVersion },
      {
        capabilities: {
          tools: capabilitiesToolsMap, // Use the map with { description, inputSchema }
          prompts: {},
        },
      },
    )

    this.setupRequestHandlers(options.tools)
    this.setupRoutes()
  }

  /**
   * Setup request handlers using the SDK Server
   */
  private setupRequestHandlers(tools: ToolImpl[]): void {
    // **Explicitly handle tools/list again**
    const ListToolsRequestSchema = z
      .object({
        method: z.literal('tools/list'),
        // We don't expect params, but passthrough allows flexibility
        params: z.record(z.any()).optional(),
      })
      .passthrough()

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('[MCPClient] Handling tools/list request explicitly')
      // Return the tools as an array, conforming to ListToolsResultSchema
      const toolList = Object.values(this.toolDefinitionsMap)
      console.log(
        `[MCPClient] Returning ${toolList.length} tools for tools/list`,
      )
      return { tools: toolList }
    })

    // Create a map for quick handler lookup for tools/call
    const toolHandlerMap = new Map<string, ToolImpl['handler']>()
    tools.forEach((impl) => {
      if (this.toolDefinitionsMap[impl.name]) {
        toolHandlerMap.set(impl.name, impl.handler)
      }
    })

    // Handler for tools/call
    if (toolHandlerMap.size > 0) {
      const CallToolRequestSchema = z
        .object({
          method: z.literal('tools/call'),
          params: z.object({
            name: z.string(),
            arguments: z.record(z.any()).optional(),
          }),
        })
        .passthrough()

      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name
        const toolArgs = request.params.arguments || {}
        console.log(
          `[MCPClient] Handling tools/call for ${toolName} at endpoint ${this.endpoint}`,
        )

        const handler = toolHandlerMap.get(toolName)
        if (!handler) {
          console.error(`[MCPClient] Unknown tool called: ${toolName}`)
          return {
            content: [
              { type: 'text', text: `Error: Unknown tool '${toolName}'` },
            ],
            isError: true,
          }
        }

        try {
          const result = await handler(toolArgs)
          console.log(
            `[MCPClient] Tool ${toolName} executed. Result:`,
            JSON.stringify(result).substring(0, 100) + '...',
          )
          return {
            content: result.content || [],
            isError: result.isError || false,
          }
        } catch (error) {
          console.error(`[MCPClient] Error executing tool ${toolName}:`, error)
          return {
            content: [
              {
                type: 'text',
                text: `Error executing tool ${toolName}: ${error}`,
              },
            ],
            isError: true,
          }
        }
      })
    }

    // Handler for prompts/list (remains the same)
    const PromptsListSchema = z
      .object({
        method: z.literal('prompts/list'),
      })
      .passthrough()
    this.server.setRequestHandler(PromptsListSchema, async () => {
      console.log('[MCPClient] Handling prompts/list via SDK Server')
      return { prompts: [] }
    })
  }

  /**
   * Set up the Express routes using SDK Transport
   */
  private setupRoutes(): void {
    // Use the RELATIVE paths defined earlier (/sse, /message)
    this.router.get(this.ssePath, async (req: Request, res: Response) => {
      console.log(
        `[MCPClient] SSE connection request to ${req.originalUrl} from ${req.ip}`,
      )

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', '*')

      // Construct the message URL using the *mounted* endpoint path
      const host = req.get('host') || 'localhost:8000'
      const protocol = req.protocol || 'http'
      const baseUrl = `${protocol}://${host}`
      // IMPORTANT: Use req.baseUrl which contains the mount path (e.g., /agent-1)
      const msgUrl = `${baseUrl}${req.baseUrl}${this.messagePath}`
      console.log(
        `[MCPClient] Calculated message URL for SSE transport: ${msgUrl}`,
      )

      const transport = new SSEServerTransport(msgUrl, res)
      const sessionId = transport.sessionId

      if (sessionId) {
        this.activeTransports[sessionId] = transport
        console.log(
          `[MCPClient] SSE Transport created for session: ${sessionId}`,
        )
      } else {
        console.error('[MCPClient] Failed to get session ID')
        res.status(500).send('Internal Server Error')
        return
      }

      const pingInterval = setInterval(() => {
        try {
          if (!res.writableEnded) {
            res.write(': ping\n\n')
          } else {
            clearInterval(pingInterval)
          }
        } catch (e) {
          console.error(
            `[MCPClient] Error sending ping for session ${sessionId}:`,
            e,
          )
          clearInterval(pingInterval)
        }
      }, 30000)

      req.on('close', () => {
        console.log(
          `[MCPClient] SSE connection closed for session ${sessionId}`,
        )
        clearInterval(pingInterval)
        transport.close()
        delete this.activeTransports[sessionId]
      })

      try {
        await this.server.connect(transport)
        console.log(`[MCPClient] SDK Server connected for session ${sessionId}`)
      } catch (err) {
        console.error(
          `[MCPClient] Error connecting SDK Server for session ${sessionId}:`,
          err,
        )
        clearInterval(pingInterval)
        delete this.activeTransports[sessionId]
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error')
        }
      }
    })

    this.router.post(this.messagePath, async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string
      if (!sessionId) {
        console.error('[MCPClient] Message request missing sessionId')
        res.status(400).send('Missing sessionId')
        return
      }

      const transport = this.activeTransports[sessionId]
      if (!transport) {
        console.error(`[MCPClient] Session not found: ${sessionId}`)
        res.status(404).send('Session not found')
        return
      }

      console.log(`[MCPClient] POST message for session: ${sessionId}`)

      try {
        await transport.handlePostMessage(req, res)
        console.log(
          `[MCPClient] SDK Transport handled POST for session ${sessionId}`,
        )
      } catch (error) {
        console.error(
          `[MCPClient] Error handlePostMessage for session ${sessionId}:`,
          error,
        )
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error')
        }
      }
    })
  }

  /**
   * Return middleware that can be used with Express
   */
  public middleware(): RequestHandler {
    return this.router
  }

  /**
   * Backward compatibility method for handler()
   */
  public handler(): RequestHandler {
    return this.middleware()
  }
}
