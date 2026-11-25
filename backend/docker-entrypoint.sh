#!/bin/sh
set -e

echo "Aplicando migraciones de base de datos..."
npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "Cargando datos iniciales..."
  node dist/prisma/seed.js
fi

exec node dist/src/server.js
