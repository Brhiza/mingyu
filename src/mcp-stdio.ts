import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, enabledMethods } from './mcp';

const mode = process.env.MINGYU_MCP_MODE === 'router' ? 'router' : 'full';
await createServer(enabledMethods(process.env.ENABLED_METHODS), undefined, { mode }).connect(new StdioServerTransport());
