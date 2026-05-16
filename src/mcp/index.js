import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFormTools } from './tools/form.js';
import { registerInboxTools } from './tools/inbox.js';
import { registerSiteTools } from './tools/site.js';
import { registerStatsTools } from './tools/stats.js';

const createMcpServer = (mcpUser) => {
    const server = new McpServer({
        name: 'puna-mcp',
        version: '1.0.0',
    });

    registerSiteTools(server, mcpUser);
    registerFormTools(server, mcpUser);
    registerInboxTools(server, mcpUser);
    registerStatsTools(server, mcpUser);

    return server;
};

export { createMcpServer };
