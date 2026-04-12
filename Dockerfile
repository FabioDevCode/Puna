# =============================================================================
# STAGE 1 — deps : installation des dépendances de production uniquement
# =============================================================================
FROM node:24-alpine AS deps

WORKDIR /app

# Copier uniquement les fichiers de dépendances pour profiter du cache Docker
# (cette couche ne se rebuilde que si package.json ou package-lock.json change)
COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts


# =============================================================================
# STAGE 2 — runner : image finale légère
# =============================================================================
FROM node:24-alpine AS runner

# Métadonnées
LABEL org.opencontainers.image.title="Puna"
LABEL org.opencontainers.image.description="Application de gestion de feedbacks"
LABEL org.opencontainers.image.authors="Fabio RAMOS LOPES"

WORKDIR /app

# Récupérer uniquement node_modules depuis le stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY server.js ./
COPY src/ ./src/
COPY scripts/ ./scripts/

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
