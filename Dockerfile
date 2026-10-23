ARG NODE_IMAGE=node:24-alpine3.24

# =============================================================================
# STAGE 1 — deps : installation des dépendances de production uniquement
# =============================================================================
FROM ${NODE_IMAGE} AS deps

WORKDIR /app

# Copier uniquement les fichiers de dépendances pour profiter du cache Docker
# (cette couche ne se rebuilde que si package.json ou package-lock.json change)
COPY package.json package-lock.json ./

# python3 / make / g++ sont requis par node-gyp pour compiler bcrypt
# npm pkg delete scripts.prepare : évite l'erreur "husky: not found" (devDep absente en prod)
RUN apk update \
    && apk upgrade \
    && apk add --no-cache python3 make g++ \
    && rm -rf /var/cache/apk/* \
    && npm pkg delete scripts.prepare \
    && npm ci --omit=dev


# =============================================================================
# STAGE 2 — runner : image finale légère
# =============================================================================
FROM ${NODE_IMAGE} AS runner

# Mettre à jour les packages système Alpine pour limiter les vulnérabilités
RUN apk update \
    && apk upgrade \
    && rm -rf /var/cache/apk/*

# Métadonnées
LABEL org.opencontainers.image.title="Puna"
LABEL org.opencontainers.image.description="Centralisez tous vos formulaires au même endroit"
LABEL org.opencontainers.image.authors="Fabio RAMOS LOPES"

WORKDIR /app

# Récupérer uniquement node_modules depuis le stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY server.js ./
COPY src/ ./src/
COPY scripts/clean-logs.js ./scripts/
COPY scripts/logs-stats.js ./scripts/
COPY scripts/rotate-logs.js ./scripts/


# Créer les répertoires persistants avec les bonnes permissions
# Ces dossiers seront montés comme volumes Docker
RUN mkdir -p storage/tmp storage/uploads logs/archives \
    && chown -R node:node /app

# Utiliser l'utilisateur non-root "node" (inclus dans l'image node:alpine)
USER node

# Port exposé (doit correspondre à PORT dans .env)
EXPOSE 3022

# Healthcheck : vérifie que le serveur répond
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3022/ || exit 1

# Note : on n'utilise PAS --env-file=.env ici
# Les variables d'environnement sont injectées par docker-compose via env_file
CMD ["node", "server.js"]
