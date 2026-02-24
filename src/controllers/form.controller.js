import { errorLogger } from '../config/logger.js';
import {
    createForm as createFormService,
    deleteForm as deleteFormService,
    verifyFormAccess,
    updateForm,
} from '../services/form.service.js';
import { getSubmissionsByFormWithFilters } from '../services/inbox.service.js';
import { verifySiteAccess } from '../services/site.service.js';

/**
 * Créer un formulaire
 */
export const createForm = async (req, res) => {
    const { name, fk_id_site } = req.body;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Vérifier l'accès au site
        const site = await verifySiteAccess(fk_id_site, userId, userRole);
        if (!site) {
            res.flash('error', 'Accès refusé.');
            return res.redirect('/dashboard');
        }

        // Créer le formulaire (le code est généré automatiquement)
        await createFormService({ name, fk_id_site });

        res.flash('success', 'Formulaire créé avec succès.');
        return res.redirect(`/site/${fk_id_site}/view?f=${name}`);
    } catch (err) {
        res.flash('error', 'Erreur lors de la création du formulaire.');
        return res.redirect('/dashboard');
    }
};

/**
 * Supprimer un formulaire
 */
export const deleteForm = async (req, res) => {
    const { form_id } = req.body;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Vérifier l'accès au formulaire
        const result = await verifyFormAccess(form_id, userId, userRole);
        if (!result) {
            res.flash('error', 'Accès refusé.');
            return res.redirect('/dashboard');
        }

        const siteId = result.form.fk_id_site;

        // Supprimer le formulaire
        await deleteFormService(form_id);

        res.flash('success', 'Formulaire supprimé.');
        return res.redirect(`/site/${siteId}/view`);
    } catch (err) {
        res.flash('error', 'Erreur lors de la suppression du formulaire.');
        return res.redirect('/dashboard');
    }
};

/**
 * Mettre à jour le template d'un formulaire
 */
export const updateFormTemplateSave = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Vérifier l'accès au formulaire
        const result = await verifyFormAccess(formId, userId, userRole);
        if (!result) {
            return res.redirect('/dashboard');
        }

        // Récupérer le template depuis req.body.template
        const newTemplate = req.body?.template || {};
        const templateObj = typeof newTemplate === 'object' ? newTemplate : {};

        // Mettre à jour le formulaire (updateForm stringifie automatiquement)
        await updateForm(formId, { template: templateObj });

        return res.redirect(`/site/${result.form.fk_id_site}/view?f=${result.form.name}`);
    } catch (err) {
        return res.redirect('/error');
    }
};

/**
 * Récupérer les entrées inbox d'un formulaire avec filtres
 */
export const getFormInbox = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';

    try {
        // Vérifier l'accès au formulaire
        const result = await verifyFormAccess(formId, userId, userRole);
        if (!result) {
            return res.status(404).json({ error: 'Form not found' });
        }

        // Parser les paramètres de pagination
        const limitRaw = parseInt(req.query.limit, 10);
        const offsetRaw = parseInt(req.query.offset, 10);
        const allowedLimits = [10, 25, 50, 100];
        const limit = allowedLimits.includes(limitRaw) ? limitRaw : 10;
        const offset = !Number.isNaN(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

        // Parser les filtres JSON
        let filters = {};
        try {
            if (req.query && req.query.filters) {
                const parsed = JSON.parse(req.query.filters);
                if (parsed && typeof parsed === 'object') {
                    filters = parsed;
                }
            }
        } catch (e) {
            // Ignorer les filtres malformés
            filters = {};
        }

        // Récupérer les données avec filtres
        const data = await getSubmissionsByFormWithFilters(formId, filters, limit, offset);

        return res.json(data);
    } catch (err) {
        errorLogger.error({ err, formId, userId: req.session?.user?.id }, 'getFormInbox error');
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Mettre à jour les colonnes visibles d'un formulaire
 */
export const updateFormColumns = async (req, res) => {
    const formId = req.params.id;
    const userId = req.session.user?.id;
    const userRole = req.userRole || req.session.user?.role || 'viewer';
    try {
        // Vérifier l'accès au formulaire
        const result = await verifyFormAccess(formId, userId, userRole);
        if (!result) {
            return res.status(404).json({ error: 'Form not found' });
        }

        // Parser les colonnes
        let cols = req.body && req.body.columns ? req.body.columns : null;
        if (typeof cols === 'string') {
            try {
                cols = JSON.parse(cols);
            } catch (e) {
                cols = null;
            }
        }

        // Valider que cols est un objet
        if (!cols || typeof cols !== 'object') {
            return res.status(400).json({ error: 'Invalid columns payload' });
        }

        // Mettre à jour (updateForm stringifie automatiquement)
        await updateForm(formId, { columns: cols });

        return res.json({ success: true, columns: cols });
    } catch (err) {
        errorLogger.error({ err, formId, userId: req.session?.user?.id }, 'updateFormColumns error');
        return res.status(500).json({ error: 'Server error' });
    }
};
