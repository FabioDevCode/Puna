import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Router } from 'express';
import { mcpLogger } from './logger.js';
import { mcpAuth } from './middlewares/auth.js';
import { createMcpServer } from './index.js';

const mcpRouter = Router();

// Mode SSE - not supported
mcpRouter.get('/', (req, res) => {
    res.status(405).json({ error: 'SSE not supported, use POST' });
});

// Mode HTTP stateless
mcpRouter.post('/', mcpAuth, async (req, res) => {
    const { userId, scope, userRole } = req.mcpUser;
    const server = createMcpServer(req.mcpUser);

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    mcpLogger.info(
        {
            userId,
            scope,
            userRole,
            method: req.body?.method,
            tool: req.body?.params?.name,
        },
        'MCP request'
    );
});

export { mcpRouter };
