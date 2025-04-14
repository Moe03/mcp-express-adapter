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
import { AsyncLocalStorage } from 'node:async_hooks' // Import AsyncLocalStorage

// Create an AsyncLocalStorage instance to hold request headers
const requestStorage = new AsyncLocalStorage<Record<string, string>>()

/**
 * MCPClient tool implementation type
 */
export interface ToolImpl<T = any> {
  name: string
  description: string
  // Use the correct SDK key: inputSchema (camelCase)
  inputSchema: Tool['inputSchema']
  handler: (
    args: T,
    context?: {
      headers?: Record<string, string>
      [key: string]: any
    },
  ) => Promise<{
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
  debug?: boolean // Add debug option to control logging
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
  private debug: boolean // Flag to control logging
  private serverName: string // Store server name
  private serverVersion: string // Store server version

  // Store active transports by sessionId
  private activeTransports: Record<string, SSEServerTransport> = {}

  /**
   * Create a new MCPClient instance
   */
  constructor(options: MCPClientOptions) {
    this.router = Router()
    this.debug = options.debug ?? false // Default to false if not provided
    this.endpoint = options.endpoint.startsWith('/')
      ? options.endpoint
      : `/${options.endpoint}`
    this.endpoint = this.endpoint.endsWith('/')
      ? this.endpoint.slice(0, -1)
      : this.endpoint // Normalize

    // Define paths RELATIVE to the endpoint mount point
    this.ssePath = '/sse'
    this.messagePath = '/message'

    this.serverName = options.serverName || 'mcp-server'
    this.serverVersion = options.serverVersion || '1.0.0'

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
        this.logError(
          `Invalid tool definition for "${impl.name}":`,
          (e as Error).message,
        )
      }
    })

    // Create the SDK Server instance with the correctly structured capabilities map
    this.server = new Server(
      { name: this.serverName, version: this.serverVersion },
      {
        capabilities: {
          tools: capabilitiesToolsMap, // Use the map with { description, inputSchema }
          prompts: {},
        },
      },
    )

    this.setupRequestHandlers(options.tools)
    this.setupRoutes()

    // Log the connection information immediately upon instantiation
    const port = process.env.PORT || '3000'
    this.logInfo(
      `Connect at: http://localhost:${port}${this.endpoint}${this.ssePath}`,
    )
    this.logInfo(
      `Run with: npx -y mcp-express-adapter --host http://localhost:${port}${this.endpoint}${this.ssePath}`,
    )
  }

  /**
   * Get the base endpoint URL for this MCP client
   */
  public getEndpoint(): string {
    return this.endpoint
  }

  /**
   * Get the full SSE endpoint URL for this MCP client
   * Note: This requires the base URL which is only known at request time
   */
  public getSSEEndpoint(baseUrl: string): string {
    // Make sure baseUrl doesn't end with a slash if endpoint starts with one
    const normalizedBaseUrl =
      baseUrl.endsWith('/') && this.endpoint.startsWith('/')
        ? baseUrl.slice(0, -1)
        : baseUrl
    return `${normalizedBaseUrl}${this.endpoint}${this.ssePath}`
  }

  /**
   * Get information about all tools registered with this client
   */
  public getTools(): Array<{ name: string; description: string }> {
    return Object.values(this.toolDefinitionsMap).map((tool) => ({
      name: tool.name,
      description: tool.description || '', // Ensure description is always a string
    }))
  }

  /**
   * Get complete metadata about this MCP client
   */
  public getMetadata(): {
    endpoint: string
    ssePath: string
    messagePath: string
    tools: Array<{ name: string; description: string }>
    debug: boolean
    serverName: string
    serverVersion: string
  } {
    // Get server info from class properties
    return {
      endpoint: this.endpoint,
      ssePath: this.ssePath,
      messagePath: this.messagePath,
      tools: this.getTools(),
      debug: this.debug,
      serverName: this.serverName,
      serverVersion: this.serverVersion,
    }
  }

  /**
   * Log debug messages only when debug is enabled
   */
  private logDebug(...args: any[]): void {
    if (this.debug) {
      console.log('[MCPClient]', ...args)
    }
  }

  /**
   * Log error messages (always shown)
   */
  private logError(...args: any[]): void {
    console.error('[MCPClient]', ...args)
  }

  /**
   * Log info messages (always shown)
   */
  private logInfo(...args: any[]): void {
    if (this.debug) {
      console.log('[MCPClient]', ...args)
    }
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
      this.logDebug('Handling tools/list request explicitly')
      // Return the tools as an array, conforming to ListToolsResultSchema
      const toolList = Object.values(this.toolDefinitionsMap)
      this.logDebug(`Returning ${toolList.length} tools for tools/list`)
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
        this.logDebug(
          `Handling tools/call for ${toolName} at endpoint ${this.endpoint}`,
        )

        const handler = toolHandlerMap.get(toolName)
        if (!handler) {
          this.logError(`Unknown tool called: ${toolName}`)
          return {
            content: [
              { type: 'text', text: `Error: Unknown tool '${toolName}'` },
            ],
            isError: true,
          }
        }

        try {
          // Retrieve headers from AsyncLocalStorage
          const headers = requestStorage.getStore() || {}
          const context = {
            headers: headers as Record<string, string>,
          }
          this.logDebug(`[tools/call] Context from AsyncLocalStorage:`, context)

          // Pass both args and context to the handler
          const result = await handler(toolArgs, context)
          this.logDebug(
            `Tool ${toolName} executed. Result:`,
            this.debug
              ? JSON.stringify(result).substring(0, 100) + '...'
              : '(hidden, enable debug to view)',
          )
          return {
            content: result.content || [],
            isError: result.isError || false,
          }
        } catch (error: any) {
          this.logError(`Error executing tool ${toolName}:`, error)
          return {
            content: [
              {
                type: 'text',
                // Use error.message for a cleaner error response
                text: `Error executing tool ${toolName}: ${error.message || error}`,
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
      this.logDebug('Handling prompts/list via SDK Server')
      return { prompts: [] }
    })
  }

  /**
   * Set up the Express routes using SDK Transport
   */
  private setupRoutes(): void {
    // Use the RELATIVE paths defined earlier (/sse, /message)
    this.router.get(this.ssePath, async (req: Request, res: Response) => {
      this.logDebug(
        `SSE connection request to ${req.originalUrl} from ${req.ip}`,
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

      // This is a critical info log that should always show
      this.logInfo(`Connect at: ${baseUrl}${req.baseUrl}${this.ssePath}`)

      // Log the command to run the MCP client
      const port = host.split(':')[1] || '3000'
      this.logInfo(
        `Run with: npx -y mcp-express-adapter --host http://localhost:${port}${req.baseUrl}${this.ssePath}`,
      )

      this.logDebug(`Calculated message URL for SSE transport: ${msgUrl}`)

      const transport = new SSEServerTransport(msgUrl, res)
      const sessionId = transport.sessionId

      if (sessionId) {
        this.activeTransports[sessionId] = transport
        this.logDebug(`SSE Transport created for session: ${sessionId}`)
      } else {
        this.logError('Failed to get session ID')
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
          this.logError(`Error sending ping for session ${sessionId}:`, e)
          clearInterval(pingInterval)
        }
      }, 30000)

      req.on('close', () => {
        this.logDebug(`SSE connection closed for session ${sessionId}`)
        clearInterval(pingInterval)
        transport.close()
        delete this.activeTransports[sessionId]
      })

      try {
        await this.server.connect(transport)
        this.logDebug(`SDK Server connected for session ${sessionId}`)
      } catch (err) {
        this.logError(
          `Error connecting SDK Server for session ${sessionId}:`,
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
        this.logError('Message request missing sessionId')
        res.status(400).send('Missing sessionId')
        return
      }

      const transport = this.activeTransports[sessionId]
      if (!transport) {
        this.logError(`Session not found: ${sessionId}`)
        res.status(404).send('Session not found')
        return
      }

      this.logDebug(`POST message for session: ${sessionId}`)
      // Node.js automatically lowercases header names.
      const headers = req.headers as Record<string, string> // Cast headers
      this.logDebug(`Headers received for session ${sessionId}:`, headers)

      try {
        // Run the message handling within the AsyncLocalStorage context
        await requestStorage.run(headers, () => {
          this.logDebug(
            `Running handlePostMessage in AsyncLocalStorage context for session ${sessionId}`,
          )
          return transport.handlePostMessage(req, res)
        })
        this.logDebug(
          `SDK Transport handled POST for session ${sessionId} (after AsyncLocalStorage)`,
        )
      } catch (error) {
        this.logError(
          `Error handlePostMessage for session ${sessionId}:`,
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
