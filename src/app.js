import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import consoleStamp from 'console-stamp';
import cookieParser from 'cookie-parser';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import express from 'express';
import { create } from 'express-handlebars';
import MySQLStoreConstructor from 'express-mysql-session';
import session from 'express-session';
import i18n from 'i18n';
import morgan from 'morgan';
import passport from 'passport';
import split from 'split';
import api from './api/index.js';
import database from './config/database.js';
import { helmetMiddleware } from './config/helmet.config.js';
import { initializePassport } from './helpers/authHelper.js';
import hbs_fn from './helpers/hbs_fn.js';
import { initAdminUSer } from './helpers/init_admin_user.js';
import { injectUserRole } from './middlewares/injectUserRole.js';
import models from './models/index.js';
import routes from './routes/index.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Sécurité: HTTP headers avec Helmet.js
// Doit être appliqué en premier, avant tous les autres middlewares
app.use(helmetMiddleware);

// Trust proxy si derrière un reverse proxy (Nginx, Apache, etc.)
app.set('trust proxy', 1);

i18n.configure({
    locales: ['fr'],
    defaultLocale: 'fr',
    directory: `${__dirname}/locales`,
    cookie: 'lang',
    queryParameter: 'lang',
    autoReload: true,
    objectNotation: true,
});

const morgan_config = {
    skip: (req) => {
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
            return true;
        }
    },
    stream: split().on('data', (line) => {
        process.stdout.write(`[${dayjs().tz('Europe/Paris').format('YYYY-MM-DD HH:mm:ss-SSS')}] ${line} \n`);
    }),
};

app.use(morgan('dev', morgan_config));

consoleStamp(console, {
    formatter: () => dayjs().tz('Europe/Paris').format('YYYY-MM-DD HH:mm:ss-SSS'),
    label: false,
    datePrefix: '',
    dateSuffix: '',
});

await models.sequelize
    .sync()
    .then(() => {
        console.log('Database & tables updated !');
    })
    .catch((err) => {
        console.error('Error sync database:', err);
    });

app.disable('x-powered-by');
app.use(cookieParser());
app.use(i18n.init);
app.use(express.static(`${__dirname}/public`));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MySQLStore = MySQLStoreConstructor(session);

const sessionStore = new MySQLStore(database);

app.use(
    session({
        name: 'puna',
        secret:
            process.env.SESSION_SECRET ||
            (() => {
                throw new Error('SESSION_SECRET must be set in environment variables');
            })(),
        store: sessionStore,
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
    })
);

initializePassport();
app.use(passport.initialize());
app.use(passport.session());

// 🆕 injectUserRole APRÈS session et passport
app.use(injectUserRole);

// Middleware pour rendre les données de session disponibles dans toutes les vues
app.use((req, res, next) => {
    res.locals.session = req.session;
    res.locals.user = req.session?.user || null;
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

await initAdminUSer();
await routes(app);
await api(app);

export default app;
