import express from 'express';
import * as exportCtl from '../controllers/export.controller.js';
import * as formCtl from '../controllers/form.controller.js';
import { requireAuth } from '../helpers/auth.helpers.js';
import { actionAccess } from '../middlewares/checkAccess.js';

const router = express.Router();

// Prefix - /form
router.post('/create', requireAuth, actionAccess('form', 'create'), formCtl.createForm);
router.post('/delete', requireAuth, actionAccess('form', 'delete'), formCtl.deleteForm);
router.get('/:id/inbox', requireAuth, actionAccess('form', 'read'), formCtl.getFormInbox);
router.post('/:id/columns', requireAuth, actionAccess('form', 'update'), formCtl.updateFormColumns);
router.post('/:id/template', requireAuth, actionAccess('form', 'update'), formCtl.updateFormTemplateSave);
router.get('/:id/export-excel', requireAuth, actionAccess('form', 'read'), exportCtl.exportFormToExcel);
router.get('/:id/export-csv', requireAuth, actionAccess('form', 'read'), exportCtl.exportFormToCSV);

export default router;
