#!/bin/sh
set -e

echo "Führe Datenbank-Migrationen aus…"
npx prisma migrate deploy

echo "Starte Server…"
exec node server.js
