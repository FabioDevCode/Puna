/**
 * Admin Logs Viewer
 * Gestion du visualiseur de logs pour l'administration
 */

(function () {
    'use strict';

    // ========================================================================
    // STATE
    // ========================================================================

    const state = {
        date: 'today',
        type: 'error',
        level: '', // Filtre par niveau (vide = tous)
        search: '',
        timeFrom: '',
        timeTo: '',
        sortOrder: 'desc', // 'desc' = plus récent en premier, 'asc' = plus ancien en premier
        loading: false,
        logs: [],
    };

    // ========================================================================
    // DOM ELEMENTS
    // ========================================================================

    let elements = {};

    /**
     * Initialise les références aux éléments DOM
     */
    function initElements() {
        elements = {
            selectDate: document.getElementById('select-date'),
            selectType: document.getElementById('select-type'),
            inputSearch: document.getElementById('input-search'),
            selectLevel: document.getElementById('select-level'),
            inputTimeFrom: document.getElementById('input-time-from'),
            inputTimeTo: document.getElementById('input-time-to'),
            btnSearch: document.getElementById('btn-search'),
            btnApplyFilters: document.getElementById('btn-apply-filters'),
            btnResetFilters: document.getElementById('btn-reset-filters'),
            btnToggleOrder: document.getElementById('btn-toggle-order'),
            btnRefresh: document.getElementById('btn-refresh'),
            logCount: document.getElementById('log-count'),
            logsLoading: document.getElementById('logs-loading'),
            logsError: document.getElementById('logs-error'),
            logsErrorMessage: document.getElementById('logs-error-message'),
            logsEmpty: document.getElementById('logs-empty'),
            logsTableContainer: document.getElementById('logs-table-container'),
            logsTbody: document.getElementById('logs-tbody'),
            modalLogDetail: document.getElementById('modal-log-detail'),
            logDetailContent: document.getElementById('log-detail-content'),
        };
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Formate un timestamp en heure lisible
     * @param {number} timestamp - Timestamp en millisecondes
     * @returns {string} Heure formatée
     */
    function formatTime(timestamp) {
        if (!timestamp) {
            return '-';
        }
        const date = new Date(timestamp);
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    /**
     * Retourne la classe CSS du badge selon le niveau de log
     * @param {number|string} level - Niveau du log
     * @returns {string} Classes CSS du badge
     */
    function getLevelBadgeClass(level) {
        const levelNum = typeof level === 'string' ? parseInt(level, 10) : level;

        switch (levelNum) {
            case 10: // trace
                return 'w-max badge badge-xs badge-outline';
            case 20: // debug
                return 'w-max badge badge-xs badge-outline badge-ghost';
            case 30: // info
                return 'w-max badge badge-xs badge-outline badge-info';
            case 40: // warn
                return 'w-max badge badge-xs badge-outline badge-warning';
            case 50: // error
                return 'w-max badge badge-xs badge-outline badge-error';
            case 60: // fatal
                return 'w-max badge badge-xs badge-outline badge-error';
            default:
        }
    }

    /**
     * Retourne le label du niveau de log
     * @param {number|string} level - Niveau du log
     * @returns {string} Label du niveau
     */
    function getLevelLabel(level) {
        const levelNum = typeof level === 'string' ? parseInt(level, 10) : level;

        switch (levelNum) {
            case 10:
                return 'TRACE';
            case 20:
                return 'DEBUG';
            case 30:
                return 'INFO';
            case 40:
                return 'WARN';
            case 50:
                return 'ERROR';
            case 60:
                return 'FATAL';
            default:
                return String(level);
        }
    }

    /**
     * Retourne la classe CSS du badge selon le status HTTP
     * @param {number|string} statusCode - Code de status HTTP
     * @returns {string} Classes CSS du badge
     */
    function getStatusBadgeClass(statusCode) {
        if (statusCode === '-') {
            return 'font-mono text-xs text-base-content/50';
        }

        const code = typeof statusCode === 'string' ? parseInt(statusCode, 10) : statusCode;

        if (code >= 200 && code < 300) {
            return 'w-max badge badge-xs badge-success';
        }
        if (code >= 300 && code < 400) {
            return 'w-max badge badge-xs badge-info';
        }
        if (code >= 400 && code < 500) {
            return 'w-max badge badge-xs badge-warning';
        }
        if (code >= 500) {
            return 'w-max badge badge-xs badge-error';
        }

        return 'w-max badge badge-xs';
    }

    /**
     * Extrait le message principal d'une entrée de log
     * @param {Object} log - Entrée de log
     * @returns {string} Message
     */
    function extractMessage(log) {
        if (log.msg) {
            return log.msg;
        }
        if (log.message) {
            return log.message;
        }
        if (log.raw) {
            return log.raw;
        }

        // Extraire les champs pertinents
        const relevantFields = ['method', 'url', 'statusCode', 'responseTime', 'action', 'user'];
        const parts = [];

        for (const field of relevantFields) {
            if (log[field] !== undefined) {
                parts.push(`${field}: ${log[field]}`);
            }
        }

        return parts.length > 0 ? parts.join(' | ') : JSON.stringify(log).substring(0, 100);
    }

    /**
     * Échappe les caractères HTML
     * @param {string} str - Chaîne à échapper
     * @returns {string} Chaîne échappée
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    /**
     * Affiche l'état de chargement
     */
    function showLoading() {
        elements.logsLoading.classList.remove('hidden');
        elements.logsError.classList.add('hidden');
        elements.logsEmpty.classList.add('hidden');
        elements.logsTableContainer.classList.add('hidden');
    }

    /**
     * Affiche une erreur
     * @param {string} message - Message d'erreur
     */
    function showError(message) {
        elements.logsLoading.classList.add('hidden');
        elements.logsError.classList.remove('hidden');
        elements.logsEmpty.classList.add('hidden');
        elements.logsTableContainer.classList.add('hidden');
        elements.logsErrorMessage.textContent = message;
    }

    /**
     * Affiche l'état vide
     */
    function showEmpty() {
        elements.logsLoading.classList.add('hidden');
        elements.logsError.classList.add('hidden');
        elements.logsEmpty.classList.remove('hidden');
        elements.logsTableContainer.classList.add('hidden');
    }

    /**
     * Affiche la table des logs
     */
    function showTable() {
        elements.logsLoading.classList.add('hidden');
        elements.logsError.classList.add('hidden');
        elements.logsEmpty.classList.add('hidden');
        elements.logsTableContainer.classList.remove('hidden');
    }

    /**
     * Met à jour le compteur
     * @param {number} count - Nombre d'entrées
     */
    function updateCount(count) {
        elements.logCount.textContent = `${count} entrée${count !== 1 ? 's' : ''}`;
    }

    /**
     * Rend les logs dans la table
     * @param {Array} logs - Liste des logs
     */
    function renderLogs(logs) {
        if (logs.length === 0) {
            showEmpty();
            updateCount(0);
            return;
        }

        // Trier selon l'ordre sélectionné
        const sortedLogs = [...logs].sort((a, b) => {
            const timeA = a.time ? new Date(a.time).getTime() : 0;
            const timeB = b.time ? new Date(b.time).getTime() : 0;
            return state.sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        const html = sortedLogs
            .map((log, index) => {
                const time = formatTime(log.time);
                const level = log.level || '-';
                const levelClass = getLevelBadgeClass(level);
                const levelLabel = getLevelLabel(level);
                const statusCode = log.res?.statusCode || log.statusCode || '-';
                const statusClass = getStatusBadgeClass(statusCode);
                const reqUrl = log.req?.url || log.url || '-';
                const message = escapeHtml(extractMessage(log));

                return `
                <tr>
                    <td class="font-mono text-xs">${time}</td>
                    <td><span class="${levelClass}">${levelLabel}</span></td>
                    <td><span class="${statusClass}">${statusCode}</span></td>
                    <td class="font-mono text-xs truncate max-w-48" title="${escapeHtml(reqUrl)}">${escapeHtml(reqUrl)}</td>
                    <td class="truncate max-w-md" title="${escapeHtml(message)}">${message}</td>
                    <td>
                        <button class="btn btn-xs btn-ghost" data-action="view-detail" data-index="${index}">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
            })
            .join('');

        elements.logsTbody.innerHTML = html;
        showTable();
        updateCount(logs.length);
    }

    // ========================================================================
    // API CALLS
    // ========================================================================

    /**
     * Charge les logs depuis l'API
     */
    async function loadLogs() {
        if (state.loading) {
            return;
        }

        state.loading = true;
        showLoading();

        try {
            const params = new URLSearchParams({
                date: state.date,
                type: state.type,
            });

            if (state.search) {
                params.set('search', state.search);
            }
            if (state.timeFrom) {
                params.set('timeFrom', state.timeFrom);
            }
            if (state.timeTo) {
                params.set('timeTo', state.timeTo);
            }
            if (state.level) {
                params.set('level', state.level);
            }

            const response = await fetch(`/admin/logs/read?${params}`);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erreur lors du chargement');
            }

            const data = await response.json();
            state.logs = data.lines || [];
            renderLogs(state.logs);
        } catch (error) {
            console.error('Erreur chargement logs:', error);
            showError(error.message);
        } finally {
            state.loading = false;
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Applique tous les filtres et charge les logs
     */
    function applyFilters() {
        state.date = elements.selectDate.value;
        state.type = elements.selectType.value;
        state.level = elements.selectLevel.value;
        state.search = elements.inputSearch.value.trim();
        state.timeFrom = elements.inputTimeFrom.value;
        state.timeTo = elements.inputTimeTo.value;
        loadLogs();
    }

    /**
     * Réinitialise tous les filtres à leurs valeurs par défaut
     */
    function resetFilters() {
        // Réinitialiser le state
        state.date = 'today';
        state.type = 'error';
        state.level = '';
        state.search = '';
        state.timeFrom = '';
        state.timeTo = '';

        // Réinitialiser les inputs
        elements.selectDate.value = 'today';
        elements.selectType.value = 'error';
        elements.selectLevel.value = '';
        elements.inputSearch.value = '';
        elements.inputTimeFrom.value = '';
        elements.inputTimeTo.value = '';

        loadLogs();
    }

    /**
     * Gère le basculement de l'ordre de tri
     */
    function handleToggleOrder() {
        state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
        // Re-render sans recharger
        renderLogs(state.logs);
    }

    /**
     * Gère la touche Entrée dans un champ de filtre
     * @param {KeyboardEvent} event
     */
    function handleFilterKeypress(event) {
        if (event.key === 'Enter') {
            applyFilters();
        }
    }

    /**
     * Gère le clic sur le bouton de détail
     * @param {number} index - Index du log dans state.logs
     */
    function showLogDetail(index) {
        const log = state.logs[index];
        if (!log) {
            return;
        }

        const formatted = JSON.stringify(log, null, 2);
        elements.logDetailContent.textContent = formatted;
        elements.modalLogDetail.showModal();
    }

    /**
     * Gère les clics sur la table (délégation)
     * @param {MouseEvent} event
     */
    function handleTableClick(event) {
        const button = event.target.closest('[data-action="view-detail"]');
        if (button) {
            const index = parseInt(button.dataset.index, 10);
            showLogDetail(index);
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    function init() {
        // Initialiser les éléments DOM
        initElements();

        // Event listeners - Boutons d'action
        elements.btnApplyFilters.addEventListener('click', applyFilters);
        elements.btnResetFilters.addEventListener('click', resetFilters);
        elements.btnSearch.addEventListener('click', applyFilters);
        elements.btnToggleOrder.addEventListener('click', handleToggleOrder);
        elements.btnRefresh.addEventListener('click', loadLogs);
        elements.logsTbody.addEventListener('click', handleTableClick);

        // Event listeners - Touche Entrée dans les champs
        elements.inputSearch.addEventListener('keypress', handleFilterKeypress);
        elements.inputTimeFrom.addEventListener('keypress', handleFilterKeypress);
        elements.inputTimeTo.addEventListener('keypress', handleFilterKeypress);

        // Chargement initial
        loadLogs();
    }

    // Démarrage
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
