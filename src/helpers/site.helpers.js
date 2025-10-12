import models from '../models/index.js';


export async function getSitesWithCounts(userId) {
    const sites = await models.Site.findAll({
        where: { fk_id_user: userId },
        raw: true
    });

    const sitesWithCounts = await Promise.all(sites.map(async (site) => {
        let formCount = 0;
        let inboxCount = 0;

        const forms = await models.Form.findAll({
            where: { fk_id_site: site.id },
            attributes: ['id'],
            raw: true
        });

        if(forms?.length) {
            formCount = forms.length;
            const formIds = forms.map(f => f.id);
            inboxCount = await models.Inbox.count({
                where: { fk_id_form: formIds }
            });
        }

        return {
            id: site.id,
            domain: site.domain,
            form: formCount,
            inbox: inboxCount
        };
    }));

    // Tri alphabétique par domaine
    sitesWithCounts.sort((a, b) => a.domain.localeCompare(b.domain));
    return sitesWithCounts;
}

export function getGlobalStats(sitesWithCounts) {
    const globalInbox = sitesWithCounts.reduce((acc, site) => acc + (site.inbox || 0), 0);
    const globalForm = sitesWithCounts.reduce((acc, site) => acc + (site.form || 0), 0);
    const globalSite = sitesWithCounts.length;
    return [
        {
            name: "Boite de réception",
            value: globalInbox,
            icon: "fas fa-inbox"
        },
        {
            name: "Formulaire",
            value: globalForm,
            icon: "fas fa-file-alt"
        },
        {
            name: "Site web",
            value: globalSite,
            icon: "fas fa-globe"
        }
    ];
}
