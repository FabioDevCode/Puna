import { createRequire } from 'node:module';
import * as builder from '../helpers/models.helpers.js';

const attributes = createRequire(import.meta.url)('./attributes/inbox.attributes.json');
const relations = createRequire(import.meta.url)('./relations/inbox.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: 'inbox',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('Inbox', attributes_build, options);
    Model.associate = builder.buildRelations('Inbox', relations);

    return Model;
}
