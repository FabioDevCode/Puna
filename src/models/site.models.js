import { createRequire } from 'node:module';
import * as builder from '../helpers/models.helpers.js';

const attributes = createRequire(import.meta.url)('./attributes/site.attributes.json');
const relations = createRequire(import.meta.url)('./relations/site.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: 'site',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('Site', attributes_build, options);
    Model.associate = builder.buildRelations('Site', relations);

    return Model;
}
