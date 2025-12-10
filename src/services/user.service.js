/**
 * Service de gestion des utilisateurs
 * Gère les opérations CRUD sur les utilisateurs (admin)
 */

import { Op } from 'sequelize';
import { User } from '../models/index.js';
import { hashPassword } from './auth.service.js';

/**
 * Récupérer tous les utilisateurs avec pagination
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Nombre d'utilisateurs par page
 * @returns {Promise<Object>} - { users, total, totalPages }
 */
export async function getAllUsers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { rows: users, count: total } = await User.findAndCountAll({
        attributes: ['id', 'email', 'name', 'role', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
    });

    return {
        users: users.map((u) => u.toJSON()),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    };
}

/**
 * Rechercher des utilisateurs par email ou nom
 * @param {string} query - Terme de recherche
 * @param {number} limit - Nombre maximum de résultats
 * @returns {Promise<Array>} - Liste des utilisateurs trouvés
 */
export async function searchUsers(query, limit = 20) {
    const users = await User.findAll({
        where: {
            [Op.or]: [{ email: { [Op.like]: `%${query}%` } }, { name: { [Op.like]: `%${query}%` } }],
        },
        attributes: ['id', 'email', 'name', 'role'],
        limit,
    });

    return users.map((u) => u.toJSON());
}

/**
 * Récupérer un utilisateur par son ID
 * @param {number} userId - ID de l'utilisateur
 * @param {boolean} includePassword - Inclure le hash du mot de passe
 * @returns {Promise<Object|null>} - Utilisateur ou null
 */
export async function getUserById(userId, includePassword = false) {
    const attributes = includePassword
        ? ['id', 'email', 'name', 'role', 'password', 'createdAt', 'updatedAt']
        : ['id', 'email', 'name', 'role', 'createdAt', 'updatedAt'];

    const user = await User.findByPk(userId, { attributes });
    return user ? user.toJSON() : null;
}

/**
 * Créer un nouvel utilisateur
 * @param {Object} userData - Données de l'utilisateur
 * @param {string} userData.email - Email
 * @param {string} userData.name - Nom
 * @param {string} userData.password - Mot de passe en clair
 * @param {string} userData.role - Rôle (super_admin, owner, beta, editor, viewer)
 * @returns {Promise<Object>} - Utilisateur créé (sans mot de passe)
 */
export async function createUser(userData) {
    const hashedPassword = await hashPassword(userData.password);

    const user = await User.create({
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role || 'viewer',
    });

    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
}

/**
 * Mettre à jour un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {Object} updateData - Données à mettre à jour
 * @param {string} [updateData.email] - Nouvel email
 * @param {string} [updateData.name] - Nouveau nom
 * @param {string} [updateData.password] - Nouveau mot de passe (en clair)
 * @param {string} [updateData.role] - Nouveau rôle
 * @returns {Promise<Object|null>} - Utilisateur mis à jour ou null
 */
export async function updateUser(userId, updateData) {
    const user = await User.findByPk(userId);
    if (!user) {
        return null;
    }

    const dataToUpdate = { ...updateData };

    // Si un nouveau mot de passe est fourni, le hasher
    if (dataToUpdate.password) {
        dataToUpdate.password = await hashPassword(dataToUpdate.password);
    }

    await user.update(dataToUpdate);

    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
}

/**
 * Supprimer un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - true si suppression réussie
 */
export async function deleteUser(userId) {
    const result = await User.destroy({
        where: { id: userId },
    });

    return result > 0;
}

/**
 * Vérifier si un email existe déjà
 * @param {string} email - Email à vérifier
 * @param {number} excludeUserId - ID utilisateur à exclure (pour updates)
 * @returns {Promise<boolean>} - true si l'email existe
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
 * Compter le nombre total d'utilisateurs
 * @returns {Promise<number>} - Nombre d'utilisateurs
 */
export async function countUsers() {
    return await User.count();
}

/**
 * Compter les utilisateurs par rôle
 * @returns {Promise<Object>} - { super_admin: 1, owner: 5, ... }
 */
export async function countUsersByRole() {
    const users = await User.findAll({
        attributes: ['role'],
    });

    const counts = {};
    users.forEach((user) => {
        counts[user.role] = (counts[user.role] || 0) + 1;
    });

    return counts;
}
