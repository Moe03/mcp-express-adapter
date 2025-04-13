# MCP Express Server Example

A simple example showing how to use `mcp-express-adapter` with an Express server, after running the express server on your local machine you can now run this to use langchain-js to create an agent with the MCP tools.

## Setup

```bash
# From the root of the workspace
pnpm install
```

## Running the Example

```bash
# From this directory
pnpm dev
```

The server will start on port 3000 (or the port specified in the PORT environment variable).

You can test the MCP endpoint by connecting to:

```
http://localhost:3000/mcp/sse
```

## Features

- Simple Express server setup
- Weather tool implementation
- MCP protocol support

## Using in Your Projects

This example demonstrates how to integrate mcp-express-adapter with an Express server. You can use this as a template for your own projects.
