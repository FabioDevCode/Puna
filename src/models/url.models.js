import { createRequire } from "node:module";
import * as builder from "../helpers/models_hlps.js";
const attributes = createRequire(import.meta.url)("./attributes/url.attributes.json");
const relations = createRequire(import.meta.url)("./relations/url.relations.json");

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: "url",
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define("Url", attributes_build, options);
    Model.associate = builder.buildRelations("Url", relations);

    return Model;
}