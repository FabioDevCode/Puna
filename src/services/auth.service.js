/**
 * Service d'authentification
 * Gère l'authentification des utilisateurs, la validation des identifiants
 * et la génération de tokens
 */

import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import models from '../models/index.js';

/**
 * Authentifier un utilisateur avec email et mot de passe
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} - Utilisateur si authentification réussie, null sinon
 */
export async function authenticateUser(email, password) {
    const user = await models.User.findOne({
        where: { email },
        attributes: ['id', 'email', 'password', 'role', 'name'],
    });

    if (!user) {
        return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        return null;
    }

    // Retourner l'utilisateur sans le mot de passe
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
}

/**
 * Créer un hash du mot de passe
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} - Hash du mot de passe
 */
export async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Vérifier si un email existe déjà dans la base de données
 * @param {string} email - Email à vérifier
 * @param {number} excludeUserId - ID utilisateur à exclure de la recherche (pour les updates)
 * @returns {Promise<boolean>} - true si l'email existe déjà
 */
export async function emailExists(email, excludeUserId = null) {
    const where = { email };

    if (excludeUserId) {
        where.id = { [Op.ne]: excludeUserId };
    }

    const user = await models.User.findOne({ where });
    return !!user;
}

/**
 * Récupérer un utilisateur par son ID avec les informations nécessaires pour la session
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur sans mot de passe
 */
export async function getUserForSession(userId) {
    const user = await models.User.findByPk(userId, {
        attributes: ['id', 'email', 'role', 'name'],
    });

    return user ? user.toJSON() : null;
}

/**
 * Vérifier un mot de passe contre un hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash bcrypt à comparer
 * @returns {Promise<boolean>} - true si le mot de passe correspond
 */
export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Rechercher un utilisateur par login (optionnellement filtrer par status)
 * @param {string} login - Login de l'utilisateur
 * @param {string} [status] - Status optionnel ('pending', 'active')
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
export async function findUserByLogin(login, status = null) {
    const where = { login };

    if (status) {
        where.status = status;
    }

    const user = await models.User.findOne({
        where,
        attributes: ['id', 'email', 'login', 'role', 'status', 'password', 'last_connection', 'createdAt'],
    });

    return user ? user.toJSON() : null;
}

/**
 * Activer un compte utilisateur en définissant le mot de passe
 * @param {string} userId - ID de l'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<boolean>} - true si activation réussie
 */
export async function activateUserAccount(userId, password) {
    const hashedPassword = await hashPassword(password);

    const [updated] = await models.User.update(
        {
            password: hashedPassword,
            status: 'active',
        },
        {
            where: { id: userId },
        }
    );

    return updated > 0;
}

/**
 * Authentifier un utilisateur avec login et mot de passe
 * @param {string} login - Login de l'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} - Utilisateur si authentification réussie, null sinon
 */
export async function authenticateUserByLogin(login, password) {
    const user = await models.User.findOne({
        where: { login, status: 'active' },
        attributes: ['id', 'email', 'login', 'password', 'role', 'status', 'last_connection'],
    });

    if (!user) {
        return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        return null;
    }

    // Retourner l'utilisateur sans le mot de passe
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
}
