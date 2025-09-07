#!/bin/bash
# Script de inicialización para Render

echo "🚀 Iniciando deploy en Render..."

# Generar cliente de Prisma
echo "📦 Generando cliente de Prisma..."
npx prisma generate

# Ejecutar migraciones
echo "🔄 Ejecutando migraciones de base de datos..."
npx prisma migrate deploy

# Crear usuarios de prueba (opcional, solo para desarrollo)
if [ "$NODE_ENV" != "production" ]; then
    echo "👥 Creando usuarios de prueba..."
    node createTestUsers.js
fi

echo "✅ Inicialización completada!"
