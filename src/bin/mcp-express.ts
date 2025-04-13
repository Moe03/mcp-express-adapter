#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  JSONRPCMessage,
  JSONRPCRequest,
  Tool,
  ListToolsResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { Logger } from '../types.js' // Assuming Logger type is defined here
import { getVersion } from '../lib/getVersion.js'
import { onSignals } from '../lib/onSignals.js'
import { parseHeaders } from '../lib/parseHeaders.js'

// --- Logging setup mirroring index.ts ---
const log = (...args: any[]) => console.log('[express-mcp-adapter]', ...args)
const logStderr = (...args: any[]) =>
  console.error('[express-mcp-adapter]', ...args)

const noneLogger: Logger = {
  info: () => {},
  error: () => {},
}

const getLogger = ({ logLevel }: { logLevel: string }): Logger => {
  if (logLevel === 'none') {
    return noneLogger
  }
  // In stdio mode, all logs go to stderr
  return { info: logStderr, error: logStderr }
}
// --- End Logging setup ---

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('$0 --host <url> [options]')
    .option('host', {
      alias: 'h',
      type: 'string',
      description:
        "URL of the Express server's SSE endpoint (e.g., http://localhost:8000/agent-1/sse)",
      demandOption: true,
    })
    .option('header', {
      type: 'array',
      string: true,
      description:
        'Headers to be added, e.g. --header "Authorization: Bearer <token>"',
    })
    .option('debug', {
      // Retain debug option, maps to logLevel
      type: 'boolean',
      default: false,
      description: 'Enable debug logging (sets logLevel to info)',
    })
    .option('logLevel', {
      choices: ['info', 'none'] as const,
      default: 'info',
      description: 'Logging level (info = stderr, none = quiet)',
    })
    .help()
    .parseSync()

  // Determine log level (debug flag overrides logLevel to 'info')
  const logLevel = argv.debug ? 'info' : argv.logLevel
  const logger = getLogger({ logLevel })

  // Extract options after parsing
  const sseUrl = argv.host as string
  const cliHeaders = (argv.header as string[] | undefined) || []
  const headers = parseHeaders(cliHeaders, logger)

  // Variables for cleanup
  let sseClient: Client | null = null
  let stdioTransport: StdioServerTransport | null = null

  try {
    logger.info('Starting...')
    logger.info(`  - sse: ${sseUrl}`)
    logger.info(
      `  - Headers: ${Object.keys(headers).length ? JSON.stringify(headers) : '(none)'}`,
    )
    logger.info('Connecting to SSE...')

    // Setup signal handling
    onSignals({ logger })

    // Create SSE transport connection
    const sseTransport = new SSEClientTransport(new URL(sseUrl), {
      eventSourceInit: {
        fetch: (...props: Parameters<typeof fetch>) => {
          const [url, init = {}] = props
          const fetchFn =
            typeof fetch !== 'undefined'
              ? fetch
              : (...args: any[]) => {
                  logger.error('Global fetch not available.')
                  throw new Error('fetch not available')
                }
          return fetchFn(url, {
            ...init,
            headers: { ...init.headers, ...headers },
          })
        },
      },
      requestInit: {
        headers,
      },
    })

    // Create an MCP Client instance
    sseClient = new Client(
      { name: 'express-mcp-adapter', version: getVersion() },
      { capabilities: {} },
    )

    // Handle transport errors
    sseTransport.onerror = (err) => {
      logger.error('SSE transport error:', err)
      process.exit(1)
    }
    sseTransport.onclose = () => {
      logger.error('SSE connection closed by server')
      process.exit(1)
    }

    // Connect the client to the transport
    await sseClient.connect(sseTransport)
    logger.info('SSE client connected successfully')

    // --- Get Actual Server Info & Capabilities ---
    const serverInfo = sseClient!.getServerVersion() || {
      name: 'unknown-mcp-server',
      version: 'unknown',
    }
    const serverCapabilities = sseClient!.getServerCapabilities() || {
      tools: {},
      prompts: {},
    }

    logger.info('Connected Server Info:', serverInfo)
    logger.info('Fetched Server Capabilities:', serverCapabilities)

    // --- Setup Stdio Server using ACTUAL capabilities ---
    // Ensure the structure passed here matches what Server expects, especially the tools map
    const stdioServer = new Server(serverInfo, {
      capabilities: serverCapabilities,
    })

    // Create and connect the Stdio Transport
    stdioTransport = new StdioServerTransport()
    await stdioServer.connect(stdioTransport)
    logger.info('Stdio server transport connected')

    // ---- Pipe messages between the two (Exact sseToStdio logic) ----

    // 1. Stdio -> SSE Client (Forward ALL requests and notifications)
    stdioTransport.onmessage = async (message: JSONRPCMessage) => {
      const isRequest = 'method' in message && 'id' in message
      if (isRequest) {
        const req = message as JSONRPCRequest
        if (logLevel === 'info')
          logger.info('Stdio -> SSE (Request):', req.method, req.id)

        // Special case for initialize - handle directly instead of forwarding
        if (req.method === 'initialize') {
          logger.info('Handling initialize request directly')
          // Send back the server info and capabilities we already have
          const response = {
            jsonrpc: '2.0' as const,
            id: req.id, // Use ORIGINAL ID from request
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: serverInfo,
              capabilities: serverCapabilities,
            },
          }
          logger.info('Responding to initialize with:', response)
          if (stdioTransport) {
            stdioTransport.send(response)
          }
          return
        }

        let result: any
        try {
          // For all other requests, use the raw transport to preserve ID
          // Create a copy of the request to send to the SSE server
          const sseRequest = { ...req }

          // Use sseTransport.request directly to preserve original ID
          // Rather than sseClient.request which assigns new IDs
          result = await new Promise((resolve, reject) => {
            // Send directly through transport
            if (!sseTransport) {
              reject({ code: -32000, message: 'SSE transport not available' })
              return
            }
            sseTransport.send(sseRequest)

            // Set up one-time handler for this specific response
            const originalId = req.id
            const responseHandler = (responseMsg: JSONRPCMessage) => {
              if ('id' in responseMsg && responseMsg.id === originalId) {
                // Remove this handler once we get the matching response
                const oldHandler = sseTransport?.onmessage
                if (sseTransport && oldHandler) {
                  sseTransport.onmessage = oldHandler
                }

                if ('error' in responseMsg) {
                  reject(responseMsg.error)
                } else if ('result' in responseMsg) {
                  resolve(responseMsg.result)
                } else {
                  resolve(null)
                }
                return true // Signal that we handled this message
              }
              return false // Signal that we didn't handle this message
            }

            // Wrap the existing handler to intercept the response
            if (sseTransport) {
              const originalHandler = sseTransport.onmessage
              sseTransport.onmessage = (msg: JSONRPCMessage) => {
                if (!responseHandler(msg)) {
                  // If response handler didn't handle it, pass to original handler
                  if (originalHandler) {
                    originalHandler(msg)
                  }
                }
              }
            }

            // Set a timeout to prevent hanging if response never comes
            setTimeout(() => {
              reject({ code: -32001, message: 'Request timed out' })
            }, 30000) // 30 second timeout
          })
        } catch (err: any) {
          logger.error('Error forwarding request Stdio -> SSE:', err)
          const errorResponse = {
            jsonrpc: '2.0' as const,
            id: req.id,
            error: {
              code: err.code || -32000,
              message: err.message || 'Failed to forward request to SSE server',
            },
          }
          if (stdioTransport) {
            stdioTransport.send(errorResponse)
          }
          return
        }

        // Forward the response back to stdio
        const response = {
          jsonrpc: '2.0' as const,
          id: req.id, // Use ORIGINAL client request ID
          ...(result && typeof result === 'object' && 'error' in result
            ? { error: result.error }
            : { result: result }),
        }

        if (logLevel === 'info') {
          const logPayload =
            'error' in response
              ? response.error
              : 'result' in response
                ? 'result received'
                : 'no result/error'
          logger.info('SSE -> Stdio (Response):', logPayload)
        }

        if (stdioTransport) {
          stdioTransport.send(response)
        }
      } else {
        // Handle notifications (no ID, just a method)
        if (logLevel === 'info')
          logger.info('Stdio -> SSE (Notification):', message)
        // Forward notifications directly to the transport
        if (sseTransport) {
          sseTransport.send(message)
        }
      }
    }

    // 2. SSE Transport -> Stdio Transport - Only for responses not handled by the promise system above
    if (sseTransport) {
      const originalOnMessage = sseTransport.onmessage
      sseTransport.onmessage = (message: JSONRPCMessage) => {
        if (logLevel === 'info') logger.info('SSE -> Stdio (Message):', message)
        // Only forward notifications (no ID) or responses that weren't handled by our promise system
        if (!('id' in message) || typeof message.id === 'undefined') {
          if (stdioTransport) {
            stdioTransport.send(message)
          }
        }
      }
    }

    logger.info('Adapter ready and piping messages.')

    // Keep process alive
    process.stdin.resume()
  } catch (err) {
    logStderr('Fatal error:', err)
    sseClient?.close()
    stdioTransport?.close()
    process.exit(1)
  }
}

// Start the main function
main()
