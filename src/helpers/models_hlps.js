import { DataTypes, Sequelize } from "sequelize";
import stringUtils from "../utils/string.js";

export const buildAttributes = (attributes) => {
	const object = {};
	for (const prop in attributes) {
		const currentValue = attributes[prop];
		if (typeof currentValue === "object" && currentValue != null) {
			switch (currentValue.type) {
				case "DATEONLY":
					object[prop] = { ...currentValue };
					object[prop].type = DataTypes.DATE;
					break;
				case "STRING(100)":
					object[prop] = { ...currentValue };
					object[prop].type = DataTypes.STRING(100);
					break;
				case "UUID":
					object[prop] = { ...currentValue };
					object[prop].type = DataTypes[currentValue.type];
					object[prop].defaultValue = Sequelize.UUIDV4;
					break;
				case "LONGTEXT":
					object[prop] = { ...currentValue };
					object[prop].type = DataTypes.TEXT("long");
					break;
				case "ENUM":
					object[prop] = { ...currentValue };
					object[prop].type = DataTypes.ENUM(currentValue.values);
					break;
				default:
					object[prop] = { ...currentValue };
					object[prop].type = DataTypes[currentValue.type];
					break;
			}
		}
	}
	return object;
};

export const buildIndexes = (attributes) => {
	const indexes = [];
	for (const key in attributes) {
		if (
			// biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
			attributes.hasOwnProperty(key) &&
			// biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
			attributes[key].hasOwnProperty("primaryKey") &&
			attributes[key].primaryKey
		) {
			indexes.push({
				name: "PRIMARY",
				unique: true,
				using: "BTREE",
				fields: [{ name: key }],
			});
		}
	}
	return indexes;
};

export const buildRelations = (modelName, relations) => {
	return (models) => {
		for (let i = 0; i < relations[i]; i++) {
			const relation = relations[i];
			const options = {};
			const target = stringUtils.capitalizeFirstLetter(relation.target);

			options.foreignKey = relation.foreignKey.toLowerCase();
			options.as = relation.as.toLowerCase();

			if (relation.relation === "belongsToMany") {
				options.otherKey = relation.otherKey;
				options.through = relation.through;
			}

			options.allowNull = true;

			if (relation.constraints != null) {
				options.constraints = relation.constraints;
			}

			models[modelName][relation.relation](models[target], options);
		}
	};
};
