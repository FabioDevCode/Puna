import { createRequire } from 'node:module';
import * as builder from '../helpers/models.helpers.js';

const attributes = createRequire(import.meta.url)('./attributes/mcp_keys.attributes.json');
const relations = createRequire(import.meta.url)('./relations/mcp_keys.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: 'mcp_keys',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('Mcp_keys', attributes_build, options);
    Model.associate = builder.buildRelations('Mcp_keys', relations);

    return Model;
}
