const config = {
    host: process.env.DB_IP || '127.0.0.1',
    port: process.env.DB_PORT || '3307',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PWD || 'password',
    database: process.env.DB_NAME || 'puna',
    dialect: process.env.DB_DIALECT || 'mariadb',
};

// SQLite support — used for E2E tests (no external DB required)
if (config.dialect === 'sqlite') {
    config.storage = process.env.DB_STORAGE || 'storage/test.sqlite';
}

export default config;
