#!/bin/bash

# Script para verificar configuración móvil
echo "🔍 Verificando configuración móvil..."
echo ""

# Mostrar variables de entorno
echo "📁 Variables de entorno (.env.local):"
cat .env.local
echo ""

# Mostrar configuración de API
echo "🔧 Configuración API (src/utils/api.js):"
head -n 6 src/utils/api.js
echo ""

# Mostrar IP actual
echo "🌐 IP actual de la PC:"
ipconfig | findstr "IPv4"
echo ""

echo "✅ Para iniciar frontend móvil, ejecuta:"
echo "npm run dev-mobile"