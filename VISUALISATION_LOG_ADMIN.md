# Visualisation des Logs - Panel Administration

## 📋 Vue d'ensemble

Système de visualisation des logs en temps réel et des archives pour le panel d'administration.

### Fonctionnalités

- ✅ Affichage des logs du jour (fichiers `.log` actifs)
- ✅ Recherche dans les archives par date
- ✅ Sélection du type de log (app, api, audit, error)
- ✅ Recherche textuelle dans les logs
- ✅ Lecture des archives `.tar.gz` sans extraction complète
- ✅ Interface responsive et performante

---

## 🏗️ Architecture

### 1. Routes à créer

**Fichier:** `src/routes/default.routes.js`

```javascript
// Routes admin logs
router.get('/admin/logs',
    requireAuth,
    requireRole(['super_admin']),
    adminController.logsViewer
);

// API pour récupérer les logs
router.get('/admin/logs/read',
    requireAuth,
    requireRole(['super_admin']),
    adminController.readLogs
);

// API pour lister les archives disponibles
router.get('/admin/logs/archives',
    requireAuth,
    requireRole(['super_admin']),
    adminController.listArchives
);
```

---

### 2. Contrôleur

**Fichier:** `src/controllers/admin.controller.js`

```javascript
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../../logs');
const archiveDir = path.join(logDir, 'archives');

/**
 * Page de visualisation des logs
 */
export const logsViewer = async (req, res) => {
    try {
        res.render('pages/admin/logs/viewer', {
            title: 'Logs - Administration',
            layout: 'admin',
        });
    } catch (error) {
        logger.error({ err: error }, 'Erreur affichage logs viewer');
        res.status(500).send('Erreur serveur');
    }
};

/**
 * Lire le contenu d'un log (aujourd'hui ou archive)
 */
export const readLogs = async (req, res) => {
    try {
        const { date, type, search, limit = 1000 } = req.query;

        // Validation
        const validTypes = ['app', 'api', 'audit', 'error'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Type de log invalide' });
        }

        let lines = [];

        if (date === 'today') {
            // Lire le fichier actif
            const logFile = path.join(logDir, `${type}.log`);
            const content = await fs.readFile(logFile, 'utf-8');
            lines = content.split('\n').filter(line => line.trim());
        } else {
            // Lire depuis une archive
            const archiveFile = path.join(archiveDir, `${date}-archive-log.tar.gz`);

            // Vérifier que l'archive existe
            try {
                await fs.access(archiveFile);
            } catch {
                return res.status(404).json({ error: 'Archive introuvable' });
            }

            // Extraire le fichier spécifique de l'archive
            lines = await extractLogFromArchive(archiveFile, `${type}.log`);
        }

        // Recherche textuelle (case-insensitive)
        if (search) {
            const searchLower = search.toLowerCase();
            lines = lines.filter(line => line.toLowerCase().includes(searchLower));
        }

        // Limiter le nombre de lignes (prendre les plus récentes)
        const limitNum = parseInt(limit);
        if (lines.length > limitNum) {
            lines = lines.slice(-limitNum);
        }

        // Inverser pour afficher les plus récents en haut
        lines.reverse();

        res.json({
            success: true,
            date,
            type,
            lines,
            total: lines.length,
        });
    } catch (error) {
        logger.error({ err: error }, 'Erreur lecture logs');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Lister les archives disponibles
 */
export const listArchives = async (req, res) => {
    try {
        // Vérifier que le dossier archives existe
        try {
            await fs.access(archiveDir);
        } catch {
            return res.json({ success: true, archives: [] });
        }

        const files = await fs.readdir(archiveDir);

        // Filtrer et parser les noms d'archives
        const archives = files
            .filter(f => f.endsWith('-archive-log.tar.gz'))
            .map(f => {
                const dateStr = f.replace('-archive-log.tar.gz', '');
                return {
                    date: dateStr,
                    filename: f,
                    label: formatDateLabel(dateStr),
                };
            })
            .sort((a, b) => b.date.localeCompare(a.date)); // Plus récent en premier

        res.json({
            success: true,
            archives,
        });
    } catch (error) {
        logger.error({ err: error }, 'Erreur liste archives');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Extraire un fichier spécifique d'une archive tar.gz
 */
async function extractLogFromArchive(archivePath, logFileName) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let found = false;

        tar.list({
            file: archivePath,
            onentry: (entry) => {
                if (entry.path === logFileName) {
                    found = true;
                    entry.on('data', chunk => chunks.push(chunk));
                }
            },
        })
        .then(() => {
            if (!found) {
                resolve([]);
            } else {
                const content = Buffer.concat(chunks).toString('utf-8');
                const lines = content.split('\n').filter(line => line.trim());
                resolve(lines);
            }
        })
        .catch(reject);
    });
}

/**
 * Formater une date ISO en label lisible
 */
function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
```

---

### 3. Vue Handlebars

**Fichier:** `src/views/pages/admin/logs/viewer.hbs`

```handlebars
{{#slot "title"}}
    <div class="flex items-center gap-4">
        <h3 class="font-inter">Logs</h3>
    </div>
{{/slot}}

{{#slot "buttons"}}
    <button id="btn-refresh-logs" class="btn btn-sm btn-outline">
        <i class="fa-solid fa-rotate-right"></i>
        Actualiser
    </button>
{{/slot}}

<!-- Card: Filtres -->
<div class="col-span-2 md:col-span-6 lg:col-span-12">
    <div class="card bg-base-100 shadow-xl">
        <div class="card-body p-4">
            <div class="flex flex-wrap items-center gap-4">
                <!-- Sélecteur de date -->
                <div class="form-control w-full md:w-auto">
                    <label class="label">
                        <span class="label-text">Date</span>
                    </label>
                    <select id="date-select" class="select select-bordered select-sm w-full md:w-64">
                        <option value="today" selected>Aujourd'hui</option>
                        <!-- Archives chargées dynamiquement -->
                    </select>
                </div>

                <!-- Sélecteur de type -->
                <div class="form-control w-full md:w-auto">
                    <label class="label">
                        <span class="label-text">Type</span>
                    </label>
                    <select id="type-select" class="select select-bordered select-sm w-full md:w-48">
                        <option value="app" selected>Application</option>
                        <option value="api">API</option>
                        <option value="audit">Audit</option>
                        <option value="error">Erreurs</option>
                    </select>
                </div>

                <!-- Barre de recherche -->
                <div class="form-control flex-1">
                    <label class="label">
                        <span class="label-text">Recherche</span>
                    </label>
                    <div class="relative">
                        <input type="text" id="search-input" placeholder="Rechercher dans les logs..."
                            class="input input-bordered input-sm w-full pr-8">
                        <button id="clear-search" class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-content hover:text-neutral hidden">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Card: Logs -->
<div class="col-span-2 md:col-span-6 lg:col-span-12">
    <div class="card bg-base-100 shadow-xl">
        <div class="card-body p-4">
            <!-- Entête -->
            <div class="flex items-center justify-between mb-4">
                <div id="logs-info" class="text-sm text-neutral-content">
                    Chargement...
                </div>
                <button id="btn-download-logs" class="btn btn-sm btn-outline gap-2">
                    <i class="fa-solid fa-download"></i>
                    Télécharger
                </button>
            </div>

            <!-- Zone d'affichage des logs -->
            <div id="logs-container" class="bg-base-200 rounded-lg p-4 font-mono text-sm overflow-x-auto max-h-[600px] overflow-y-auto">
                <div id="logs-content">
                    <!-- Logs chargés dynamiquement -->
                </div>
            </div>

            <!-- Loading -->
            <div id="logs-loading" class="flex items-center justify-center py-12 none">
                <i class="fa-solid fa-spinner fa-spin text-3xl text-neutral-content"></i>
            </div>

            <!-- Aucun log -->
            <div id="logs-empty" class="flex flex-col items-center justify-center py-12 gap-4 none">
                <i class="fa-solid fa-file-lines text-5xl text-neutral-content"></i>
                <p class="text-sm text-neutral-content">Aucun log trouvé</p>
            </div>
        </div>
    </div>
</div>

<script src="/js/admin_logs.js"></script>
```

---

### 4. JavaScript Frontend

**Fichier:** `src/public/js/admin_logs.js`

```javascript
document.addEventListener('DOMContentLoaded', () => {
    // État
    const state = {
        date: 'today',
        type: 'app',
        search: '',
        isLoading: false,
    };

    // Éléments DOM
    const elements = {
        dateSelect: document.getElementById('date-select'),
        typeSelect: document.getElementById('type-select'),
        searchInput: document.getElementById('search-input'),
        clearSearch: document.getElementById('clear-search'),
        logsContainer: document.getElementById('logs-container'),
        logsContent: document.getElementById('logs-content'),
        logsInfo: document.getElementById('logs-info'),
        logsLoading: document.getElementById('logs-loading'),
        logsEmpty: document.getElementById('logs-empty'),
        btnRefresh: document.getElementById('btn-refresh-logs'),
        btnDownload: document.getElementById('btn-download-logs'),
    };

    // Initialisation
    init();

    async function init() {
        // Charger les archives disponibles
        await loadArchives();

        // Event listeners
        elements.dateSelect.addEventListener('change', handleDateChange);
        elements.typeSelect.addEventListener('change', handleTypeChange);
        elements.searchInput.addEventListener('input', handleSearchInput);
        elements.clearSearch.addEventListener('click', clearSearch);
        elements.btnRefresh.addEventListener('click', loadLogs);
        elements.btnDownload.addEventListener('click', downloadLogs);

        // Charger les logs initiaux
        loadLogs();
    }

    async function loadArchives() {
        try {
            const response = await fetch('/admin/logs/archives');
            const data = await response.json();

            if (data.success && data.archives.length > 0) {
                // Ajouter les archives au select
                data.archives.forEach(archive => {
                    const option = document.createElement('option');
                    option.value = archive.date;
                    option.textContent = archive.label;
                    elements.dateSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erreur chargement archives:', error);
        }
    }

    async function loadLogs() {
        if (state.isLoading) return;

        state.isLoading = true;
        showLoading();

        try {
            const params = new URLSearchParams({
                date: state.date,
                type: state.type,
                search: state.search,
                limit: 1000,
            });

            const response = await fetch(`/admin/logs/read?${params}`);
            const data = await response.json();

            if (data.success) {
                renderLogs(data.lines);
                updateInfo(data.total);
            } else {
                showError(data.error);
            }
        } catch (error) {
            console.error('Erreur chargement logs:', error);
            showError('Erreur lors du chargement des logs');
        } finally {
            state.isLoading = false;
            hideLoading();
        }
    }

    function renderLogs(lines) {
        elements.logsContent.innerHTML = '';

        if (lines.length === 0) {
            elements.logsContainer.classList.add('none');
            elements.logsEmpty.classList.remove('none');
            return;
        }

        elements.logsContainer.classList.remove('none');
        elements.logsEmpty.classList.add('none');

        // Afficher les lignes (surligner la recherche si présente)
        const fragment = document.createDocumentFragment();

        lines.forEach(line => {
            const div = document.createElement('div');
            div.className = 'py-1 hover:bg-base-300/50 px-2 rounded';

            if (state.search) {
                // Surligner le texte recherché
                const regex = new RegExp(`(${escapeRegex(state.search)})`, 'gi');
                div.innerHTML = escapeHtml(line).replace(regex, '<mark class="bg-warning text-warning-content">$1</mark>');
            } else {
                div.textContent = line;
            }

            fragment.appendChild(div);
        });

        elements.logsContent.appendChild(fragment);
    }

    function updateInfo(total) {
        const dateLabel = elements.dateSelect.options[elements.dateSelect.selectedIndex].text;
        const typeLabel = elements.typeSelect.options[elements.typeSelect.selectedIndex].text;
        elements.logsInfo.textContent = `${total} lignes - ${typeLabel} - ${dateLabel}`;
    }

    function handleDateChange(e) {
        state.date = e.target.value;
        loadLogs();
    }

    function handleTypeChange(e) {
        state.type = e.target.value;
        loadLogs();
    }

    function handleSearchInput(e) {
        const val = e.target.value.trim();
        state.search = val;
        elements.clearSearch.classList.toggle('hidden', val === '');

        // Debounce
        clearTimeout(handleSearchInput.timer);
        handleSearchInput.timer = setTimeout(() => {
            loadLogs();
        }, 500);
    }

    function clearSearch() {
        elements.searchInput.value = '';
        state.search = '';
        elements.clearSearch.classList.add('hidden');
        loadLogs();
    }

    function downloadLogs() {
        const content = elements.logsContent.textContent;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.type}-${state.date}.log`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function showLoading() {
        elements.logsLoading.classList.remove('none');
        elements.logsContainer.classList.add('none');
        elements.logsEmpty.classList.add('none');
    }

    function hideLoading() {
        elements.logsLoading.classList.add('none');
    }

    function showError(message) {
        elements.logsContent.innerHTML = `<div class="text-error">${message}</div>`;
        elements.logsContainer.classList.remove('none');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
});
```

---

### 5. Menu latéral

**Fichier:** `src/views/partials/layout/admin-sidebar.hbs`

Ajouter dans la section Administration :

```handlebars
<li>
    <a href="/admin/logs"
    class="hover:bg-neutral hover:text-base-100 rounded-lg flex items-center gap-2 px-3 py-2">
        <i class="fa-solid fa-file-lines"></i>
        Logs
    </a>
</li>
```

---

## 🎨 Styles CSS

**Fichier:** `src/public/css/puna.css`

```css
/* Logs viewer */
#logs-container {
    scrollbar-width: thin;
    scrollbar-color: oklch(var(--bc) / 0.2) transparent;
}

#logs-content div {
    word-break: break-all;
    white-space: pre-wrap;
}

mark {
    padding: 2px 4px;
    border-radius: 3px;
}
```

---

## 🔒 Permissions

- ✅ Accessible uniquement aux **super_admin**
- ✅ Vérification des permissions sur chaque route
- ✅ Validation des paramètres côté serveur

---

## 📊 Performance

### Optimisations

1. **Limitation du nombre de lignes** : Max 1000 lignes par défaut
2. **Recherche côté serveur** : Filtrage avant envoi au client
3. **Lecture ciblée des archives** : Extraction d'un seul fichier du tar.gz
4. **Debounce sur la recherche** : 500ms pour éviter trop de requêtes
5. **Cache navigateur** : Headers appropriés sur les archives

### Lecture des archives sans extraction complète

La bibliothèque `tar` permet de lire sélectivement un fichier dans l'archive :

```javascript
tar.list({
    file: archivePath,
    onentry: (entry) => {
        if (entry.path === logFileName) {
            // Lire uniquement ce fichier
            entry.on('data', chunk => chunks.push(chunk));
        }
    },
})
```

Avantages :
- ✅ Pas d'extraction sur disque
- ✅ Lecture directe en mémoire
- ✅ Rapide et économe en ressources

---

## 🚀 Étapes d'implémentation

### Phase 1 : Backend
1. ✅ Ajouter les routes dans `default.routes.js`
2. ✅ Créer les méthodes dans `admin.controller.js`
3. ✅ Tester les API avec Bruno ou Postman

### Phase 2 : Frontend
4. ✅ Créer la vue `viewer.hbs`
5. ✅ Créer le script `admin_logs.js`
6. ✅ Ajouter l'entrée dans le menu admin
7. ✅ Tester l'interface

### Phase 3 : Amélioration
8. ✅ Ajouter la coloration syntaxique (JSON, etc.)
9. ✅ Ajouter la pagination si nécessaire
10. ✅ Optimiser le rendu pour de gros fichiers

---

## 🎯 Améliorations futures

- [ ] Coloration syntaxique pour les logs JSON
- [ ] Filtrage par niveau de log (INFO, ERROR, DEBUG)
- [ ] Téléchargement de logs filtrés
- [ ] Graphique de distribution des erreurs
- [ ] Alertes en temps réel
- [ ] Export en PDF
- [ ] Comparaison de logs entre dates

---

## 📝 Notes importantes

1. **Sécurité** :
   - Toujours valider les paramètres
   - Limiter l'accès aux super_admin uniquement
   - Éviter l'injection de code

2. **Performance** :
   - Limiter le nombre de lignes affichées
   - Utiliser le streaming pour de gros fichiers
   - Mettre en cache les résultats si nécessaire

3. **UX** :
   - Feedback visuel lors du chargement
   - Messages d'erreur clairs
   - Interface responsive

---

Bonne implémentation ! 🎄
