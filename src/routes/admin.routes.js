import express from 'express';
import * as adminCtl from '../controllers/admin/index.js';
import { requireAuth } from '../helpers/auth.helpers.js';
import { roleAccess } from '../middlewares/checkAccess.js';

const router = express.Router();

// Prefix - /admin
router.get('/', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.admin);
router.get('/users', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsers);
router.get('/users/list', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersList);
router.get('/users/export-excel', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersExportExcel);
router.get('/users/export-csv', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersExportCSV);
router.post('/users/create', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminCreateUser);
router.post('/users/delete', requireAuth, roleAccess(['super_admin']), adminCtl.adminDeleteUser);
router.get('/users/:id/view', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminViewUser);
router.get('/users/:id/edit', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminEditUser);
router.post('/users/:id/update', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUpdateUser);
router.post('/users/:id/status', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminChangeUserStatus);
router.get('/logs', requireAuth, roleAccess(['super_admin']), adminCtl.logsViewer);
router.get('/logs/read', requireAuth, roleAccess(['super_admin']), adminCtl.readLogs);
router.get('/logs/archives', requireAuth, roleAccess(['super_admin']), adminCtl.getArchives);

export default router;
