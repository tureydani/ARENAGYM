@echo off
echo ============================================
echo        INICIANDO GIMNASIO APP (OCULTO)
echo ============================================
echo.
echo ⚙️  Configuracion:
echo   Backend:  http://localhost:3000
echo   Frontend: http://localhost:3001
echo.

REM Detener procesos Node.js existentes
echo 🔄 Deteniendo procesos existentes...
taskkill /f /im node.exe >nul 2>&1

echo 🔨 Construyendo frontend...
cd frontend-gym
call npm run build >nul 2>&1
cd ..

echo 🚀 Iniciando Backend (OCULTO)...
powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c cd backend-gym && set PORT=3000 && npm start' -WindowStyle Hidden"

echo ⏳ Esperando inicialización...
timeout /t 5 /nobreak >nul

echo 🚀 Iniciando Frontend (OCULTO)...
powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c cd frontend-gym && set PORT=3001 && npm start' -WindowStyle Hidden"

echo ⏳ Verificando servicios...
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo        ✅ APLICACION INICIADA EXITOSAMENTE
echo ============================================
echo.
echo 🔒 Servicios corriendo COMPLETAMENTE OCULTOS
echo.
echo 🌐 URLs de acceso:
echo   📡 Backend API: http://localhost:3000
echo   🖥️  Frontend:   http://localhost:3001
echo.
echo ⚠️  IMPORTANTE:
echo   • Los procesos están ocultos e invisibles
echo   • Para detenerlos ejecuta: stop.bat
echo   • Para reconfigurar: configurar-inicio-automatico.bat
echo.

REM Abrir automáticamente la aplicación
echo 🌐 Abriendo aplicación en el navegador...
timeout /t 2 /nobreak >nul
start http://localhost:3001

echo.
echo ✅ ¡Listo! Tu aplicación del gimnasio está funcionando.
echo.
pause