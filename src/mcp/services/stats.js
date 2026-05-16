import dayjs from 'dayjs';
import models from '../../models/index.js';

export async function getMcpStatsSubmission(userId, days = 7) {
    const end = dayjs().endOf('day');
    const start = dayjs()
        .startOf('day')
        .subtract(days - 1, 'day');
    const labels = Array.from({ length: days }, (_, i) => dayjs(start).add(i, 'day').format('YYYY-MM-DD'));

    const sql = `
        SELECT DATE(i.createdAt) AS day_str, COUNT(i.id) AS cnt
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE s.fk_id_user = :userId
          AND i.createdAt BETWEEN :start AND :end
        GROUP BY DATE(i.createdAt)
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId, start: start.toDate(), end: end.toDate() },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    const countMap = Object.fromEntries((rows || []).map((r) => [dayjs(r.day_str).format('YYYY-MM-DD'), Number(r.cnt) || 0]));

    return { labels, data: labels.map((l) => countMap[l] || 0) };
}

export async function getMcpStatsTopSite(userId) {
    const sql = `
        SELECT s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS cnt
        FROM site s
        LEFT JOIN form f ON f.fk_id_site = s.id
        LEFT JOIN inbox i ON i.fk_id_form = f.id
        WHERE s.fk_id_user = :userId
        GROUP BY s.id, s.domain
        ORDER BY cnt DESC
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    return (rows || []).map((r) => ({ site_id: r.site_id, domain: r.site_domain, count: Number(r.cnt) || 0 }));
}

export async function getMcpStatsTopForm(userId, days = 7) {
    const end = dayjs().endOf('day');
    const start = dayjs()
        .startOf('day')
        .subtract(days - 1, 'day');

    const sql = `
        SELECT f.id AS form_id, f.name AS form_name, s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS cnt
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE s.fk_id_user = :userId
          AND i.createdAt BETWEEN :start AND :end
        GROUP BY i.fk_id_form, f.name, s.domain
        ORDER BY cnt DESC
        LIMIT 5
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId, start: start.toDate(), end: end.toDate() },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    return (rows || []).map((r, i) => ({
        rank: i + 1,
        form_id: r.form_id,
        form_name: r.form_name,
        site_id: r.site_id,
        site_domain: r.site_domain,
        count: Number(r.cnt) || 0,
    }));
}

// ⚠️ MySQL uniquement (DAYOFWEEK, HOUR) — non fonctionnel sur SQLite
export async function getMcpStatsHeatmap(userId, userRole, days = 7) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const siteFilter = userRole === 'super_admin' ? '' : 'AND s.fk_id_user = :userId';

    const sql = `
        SELECT DAYOFWEEK(i.createdAt) AS dow, HOUR(i.createdAt) AS h, COUNT(i.id) AS cnt
        FROM inbox i
        JOIN form f ON f.id = i.fk_id_form
        JOIN site s ON s.id = f.fk_id_site
        WHERE i.createdAt BETWEEN :start AND :end
          ${siteFilter}
        GROUP BY DAYOFWEEK(i.createdAt), HOUR(i.createdAt)
    `;

    const rows = await models.sequelize.query(sql, {
        replacements: { userId, start, end },
        type: models.Sequelize.QueryTypes.SELECT,
    });

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));

    (rows || []).forEach((r) => {
        const idx = (Number(r.dow) + 5) % 7; // DAYOFWEEK: 1=Sun → Lun=0..Dim=6
        matrix[idx][Number(r.h)] = Number(r.cnt) || 0;
    });

    return {
        hours,
        series: daysOfWeek.map((d, i) => ({ name: d, data: hours.map((h, j) => ({ x: h, y: matrix[i][j] })) })).reverse(),
    };
}
