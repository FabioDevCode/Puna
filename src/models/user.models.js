import { createRequire } from 'node:module';
import * as builder from '../helpers/models.helpers.js';

const attributes = createRequire(import.meta.url)('./attributes/user.attributes.json');
const relations = createRequire(import.meta.url)('./relations/user.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: 'user',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('User', attributes_build, options);
    Model.associate = builder.buildRelations('User', relations);

    return Model;
}
