import { apiLogger } from '../config/logger.js';

export const mcpLogger = apiLogger.child({ service: 'mcp' });
