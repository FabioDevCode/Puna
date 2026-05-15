import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import consoleStamp from 'console-stamp';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import express from 'express';
import { create } from 'express-handlebars';
import MySQLStoreConstructor from 'express-mysql-session';
import session from 'express-session';
import i18n from 'i18n';
import passport from 'passport';
import pinoHttp from 'pino-http';
import api from './api/index.js';
import { corsApiPublic } from './config/cors.config.js';
import database from './config/database.js';
import { helmetMiddleware } from './config/helmet.config.js';
import { logger, apiLogger, errorLogger } from './config/logger.js';
import { mailEnabled } from './config/mailer.js';
import { setSessionStore } from './config/sessionStore.js';
import { initializePassport } from './helpers/auth.helpers.js';
import hbs_fn from './helpers/hbs.helpers.js';
import { initAdminUser } from './helpers/init_admin_user.helpers.js';
import { mcpRouter } from './mcp/router.js';
import { csrfProtection, csrfTokenInjector } from './middlewares/csrf.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import flashMessages from './middlewares/flashMessages.js';
import { injectUserRole } from './middlewares/injectUserRole.js';
import sanitizeAll from './middlewares/sanitize.js';
import models from './models/index.js';
import routes from './routes/index.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// Sécurité: HTTP headers avec Helmet.js
// Doit être appliqué en premier, avant tous les autres middlewares
app.use(helmetMiddleware);

// CORS — uniquement pour les routes API publiques (/api/*)
// Les routes web n'ont pas de CORS (same-origin, protégées par sessions + CSRF)
app.use('/api', cors(corsApiPublic));

// Trust proxy si derrière un reverse proxy (Nginx, Apache, etc.)
app.set('trust proxy', 1);

i18n.configure({
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    directory: `${__dirname}/locales`,
    cookie: 'lang',
    queryParameter: 'lang',
    autoReload: true,
    objectNotation: true,
});

// Logger Pino HTTP
app.use((req, res, next) => {
    // Skip les ressources statiques pour ne pas polluer les logs
    if (
        req.url === '/' ||
        req.url.includes('/css') ||
        req.url.includes('/img') ||
        req.url.includes('/js') ||
        req.url.includes('/plugins') ||
        req.url.includes('/devtools') ||
        req.url.includes('/favicon.ico') ||
        req.url.includes('/.well-known/appspecific/com.chrome.devtools.json')
    ) {
        return next();
    }

    // Utiliser le bon logger selon le type de requête
    const isApi = req.url.startsWith('/api/') || req.url.startsWith('/send/');
    const httpLogger = pinoHttp({
        logger: isApi ? apiLogger : logger,
        autoLogging: true,
        customLogLevel: (req, res, _err) => {
            if (res.statusCode >= 500) {
                return 'error';
            }
            if (res.statusCode >= 400) {
                return 'warn';
            }
            return 'info';
        },
    });

    httpLogger(req, res);
    next();
});

consoleStamp(console, {
    formatter: () => dayjs().tz('Europe/Paris').format('YYYY-MM-DD HH:mm:ss-SSS'),
    label: false,
    datePrefix: '',
    dateSuffix: '',
});

await models.sequelize
    .sync()
    .then(() => {
        logger.info('Database & tables updated');
    })
    .catch((err) => {
        errorLogger.error({ err }, 'Error sync database');
    });

app.disable('x-powered-by');
app.use(cookieParser());
app.use(i18n.init);
app.use(express.static(`${__dirname}/public`));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeAll);

// Session store — MySQL/MariaDB in production, MemoryStore for SQLite (E2E tests)
let sessionStore;
if (database.dialect === 'sqlite') {
    // MemoryStore is acceptable for testing — sessions are not persisted across restarts
    sessionStore = undefined; // express-session uses MemoryStore by default
} else {
    const MySQLStore = MySQLStoreConstructor(session);
    sessionStore = new MySQLStore(database);
}

// Rendre le session store accessible aux services (purge de sessions par userId)
setSessionStore(sessionStore);

const sessionConfig = {
    name: 'puna',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true if https (HTTPS requis)
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '43200000', 10), // 12 heures par défaut
        sameSite: 'lax',
    },
    rolling: false,
    unset: 'destroy',
};

if (sessionStore) {
    sessionConfig.store = sessionStore;
}

app.use(session(sessionConfig));

initializePassport();
app.use(passport.initialize());
app.use(passport.session());

// Flash messages - doit être après la session
app.use(flashMessages);

// injectUserRole APRÈS session et passport
app.use(injectUserRole);

// Locale utilisateur
app.use((req, res, next) => {
    if (req.session?.user?.locale) {
        req.setLocale(req.session.user.locale);
        res.setLocale(req.session.user.locale);
    }
    // Injecter la locale dans res.locals pour qu'elle soit accessible
    // dans options.data.root des helpers Handlebars, y compris dans les blocs {{#each}}
    res.locals.locale = req.getLocale();
    next();
});

// Protection CSRF - doit être après session, cookieParser et passport
app.use(csrfProtection);
app.use(csrfTokenInjector);

// Middleware pour rendre les données de session disponibles dans toutes les vues
app.use((req, res, next) => {
    res.locals.session = req.session;
    res.locals.user = req.session?.user || null;
    next();
});

// Inject mailEnabled into all templates
app.use((req, res, next) => {
    res.locals.mailEnabled = mailEnabled;
    next();
});

// Injecter les traductions JS client dans les locals
app.use((req, res, next) => {
    res.locals.clientI18n = JSON.stringify(res.__('js') || {});
    next();
});

const hbs = create({
    defaultLayout: 'main',
    layoutsDir: `${__dirname}/views/layouts`,
    partialsDir: `${__dirname}/views/partials`,
    extname: '.hbs',
    helpers: hbs_fn,
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', [`${__dirname}/views/pages`]);
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use((_, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
});

await initAdminUser();
await routes(app);
await api(app);

// MCP ===================
app.use('/mcp', mcpRouter);

// Middleware 404 — aucune route ne correspond
// Doit être placé après toutes les routes, avant les gestionnaires d'erreur
app.use((req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'Route not found' });
    }
    return res.status(404).render('errors/404', { layout: false });
});

// Gestionnaire d'erreur CSRF — redirige avec un flash au lieu d'un 403 brut
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        logger.warn({ url: req.originalUrl, method: req.method }, 'CSRF token invalide');
        if (typeof res.flash === 'function') {
            res.flash('error', 'Session expirée ou jeton invalide. Veuillez réessayer.');
        }
        return res.redirect('back');
    }
    next(err);
});

// Gestionnaire d'erreurs global — doit être le dernier middleware
// Intercepte tout next(err) non géré en amont
app.use(errorHandler);

export default app;
