import http from 'node:http';
import app from './src/app.js';

const PORT = process.env.PORT || 3022;
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Puna started on : ${PORT} `);
});
