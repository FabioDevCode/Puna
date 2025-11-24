import { createRequire } from 'node:module';
import * as builder from '../helpers/models_hlps.js';

const attributes = createRequire(import.meta.url)('./attributes/site_user.attributes.json');
const relations = createRequire(import.meta.url)('./relations/site_user.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: 'site_user',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('SiteUser', attributes_build, options);
    Model.associate = builder.buildRelations('SiteUser', relations);

    return Model;
}
