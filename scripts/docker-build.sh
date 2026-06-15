#!/bin/bash
# scripts/docker-build.sh
#
# Génère et publie les images Docker multi-arch sur DockerHub.
#
# Prérequis :
#   - Être connecté via `docker login`
#   - Avoir créé le builder buildx (une seule fois) :
#       docker buildx create --name multiarch --driver docker-container --use
#
# Usage :
#   ./scripts/docker-build.sh 1.0.0

set -e  # stoppe le script si une commande échoue

IMAGE="fabiodevcode/puna"
VERSION=$1

if [ -z "$VERSION" ]; then
  echo "✘ Version manquante"
  echo "Usage: ./scripts/docker-build.sh <version>  (ex: ./scripts/docker-build.sh 1.0.0)"
  exit 1
fi

echo "🔨 Build multi-arch $IMAGE:$VERSION..."

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag $IMAGE:$VERSION \
  --tag $IMAGE:latest \
  --push \
  .

echo ""
echo "✔ Publié sur DockerHub :"
echo "   → fabiodevcode/puna:$VERSION"
echo "   → fabiodevcode/puna:latest"