import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Op, Sequelize } from 'sequelize';
import db_config from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize(
    db_config.database,
    db_config.user,
    db_config.password,
    {
        host: db_config.host,
        dialect: db_config.dialect,
        port: db_config.port,
        logging: false,
        dialectOptions: {
            multipleStatements: true,
        },
        define: {
            timestamps: true,
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
        timezone: '+00:00',
    }
);

const models = {
    Sequelize,
    sequelize,
    Op,
};

const importModel = async (filePath) => {
    const { default: modelImporter } = await import(filePath);
    return modelImporter(sequelize);
};

const modelFiles = fs.readdirSync(__dirname).filter((file) => file.endsWith('.models.js'));

for (const file of modelFiles) {
    const model = await importModel(path.join(__dirname, file));
    models[model.name] = model;
}

for (const modelName in models) {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
}

export default models;
