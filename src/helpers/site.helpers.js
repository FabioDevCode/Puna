import { Op } from 'sequelize';
import models from '../models/index.js';

/**
 * Construit la condition WHERE pour les sites selon le rôle
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur
 * @returns {Promise<Object|null>} Condition WHERE ou null si super_admin
 */
export async function getSiteWhereCondition(userId, userRole = 'viewer') {
    if (userRole === 'super_admin') {
        // Super_admin voit tout - pas de filtre
        return null;
    } else if (userRole === 'owner' || userRole === 'beta') {
        // Owner et beta voient seulement leurs sites
        return { fk_id_user: userId };
    } else if (userRole === 'editor' || userRole === 'viewer') {
        // Editor et viewer voient seulement les sites assignés
        const siteAssignments = await models.SiteUser.findAll({
            where: { fk_id_user: userId },
            attributes: ['fk_id_site'],
            raw: true,
        });

        const assignedSiteIds = siteAssignments.map((sa) => sa.fk_id_site);

        if (assignedSiteIds.length > 0) {
            return { id: { [Op.in]: assignedSiteIds } };
        } else {
            // Aucun site assigné - retourner condition impossible
            return { id: null };
        }
    }

    // Fallback viewer
    return { id: null };
}

/**
 * Récupère les sites avec leurs compteurs en fonction du rôle
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur (super_admin, owner, editor, viewer, beta)
 * @returns {Promise<Array>} Liste des sites avec compteurs
 */
export async function getSitesWithCounts(userId, userRole = 'viewer') {
    const whereCondition = await getSiteWhereCondition(userId, userRole);

    // Construire la requête
    const queryOptions = { raw: true };
    if (whereCondition) {
        queryOptions.where = whereCondition;
    }

    const sites = await models.Site.findAll(queryOptions);

    const sitesWithCounts = await Promise.all(
        sites.map(async (site) => {
            let formCount = 0;
            let inboxCount = 0;

            const forms = await models.Form.findAll({
                where: { fk_id_site: site.id },
                attributes: ['id'],
                raw: true,
            });

            if (forms?.length) {
                formCount = forms.length;
                const formIds = forms.map((f) => f.id);
                inboxCount = await models.Inbox.count({
                    where: { fk_id_form: formIds },
                });
            }

            return {
                id: site.id,
                domain: site.domain,
                form: formCount,
                inbox: inboxCount,
            };
        })
    );

    // Tri alphabétique par domaine
    sitesWithCounts.sort((a, b) => a.domain.localeCompare(b.domain));
    return sitesWithCounts;
}

export function getGlobalStats(sitesWithCounts) {
    const globalInbox = sitesWithCounts.reduce((acc, site) => acc + (site.inbox || 0), 0);
    const globalForm = sitesWithCounts.reduce((acc, site) => acc + (site.form || 0), 0);
    const globalSite = sitesWithCounts.length;

    const tinyStats = {
        globalInbox,
        globalInbox_icon: 'fas fa-inbox',
        globalForm,
        globalForm_icon: 'fas fa-file-alt',
        globalSite,
        globalSite_icon: 'fas fa-globe',
    };

    return tinyStats;
}
