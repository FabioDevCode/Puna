const hasScope = (userScope, allowedScopes) => {
    return allowedScopes.includes(userScope);
};

const mcpResponse = (data) => ({
    content: [{ type: 'text', text: JSON.stringify(data) }],
});

const mcpError = (message) => ({
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
});

export { hasScope, mcpResponse, mcpError };
