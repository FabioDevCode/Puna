export default {
    host: process.env.DB_IP || '127.0.0.1',
    port: process.env.DB_PORT || '3307',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PWD || 'password',
    database: process.env.DB_NAME || 'puna',
    dialect: process.env.DB_DIALECT || 'mariadb',
};
