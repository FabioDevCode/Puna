import http from 'node:http';
import app from './src/app.js';
import { validateEnv } from './src/config/env.validator.js';

// Valider les variables d'environnement AVANT tout le reste
validateEnv();

const PORT = process.env.PORT || 3022;
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Puna started on : ${PORT} `);
});
