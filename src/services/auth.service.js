/**
 * Service d'authentification
 * Gère l'authentification des utilisateurs, la validation des identifiants
 * et la génération de tokens
 */

import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User } from '../models/index.js';

/**
 * Authentifier un utilisateur avec email et mot de passe
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} - Utilisateur si authentification réussie, null sinon
 */
export async function authenticateUser(email, password) {
    const user = await User.findOne({
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

    const user = await User.findOne({ where });
    return !!user;
}

/**
 * Récupérer un utilisateur par son ID avec les informations nécessaires pour la session
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur sans mot de passe
 */
export async function getUserForSession(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'role', 'name'],
    });

    return user ? user.toJSON() : null;
}
