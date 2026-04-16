import { createRequire } from 'node:module';
import * as builder from '../helpers/models.helpers.js';

const attributes = createRequire(import.meta.url)('./attributes/form.attributes.json');
const relations = createRequire(import.meta.url)('./relations/form.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: 'form',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('Form', attributes_build, options);
    Model.associate = builder.buildRelations('Form', relations);

    return Model;
}
