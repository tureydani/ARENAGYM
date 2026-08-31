@echo off
echo ============================================
echo        INICIANDO GIMNASIO APP (OCULTO)
echo ============================================
echo.
echo ⚙️  Configuracion:
echo   App (frontend + API): http://localhost:3001
echo.

REM Detener procesos Node.js existentes
echo 🔄 Deteniendo procesos existentes...
taskkill /f /im node.exe >nul 2>&1

echo 🔨 Construyendo aplicacion...
cd frontend-gym
call npm run build >nul 2>&1
cd ..

echo 🚀 Iniciando aplicacion (OCULTO)...
powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c cd frontend-gym && set PORT=3001 && npm start' -WindowStyle Hidden"

echo ⏳ Verificando servicio...
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo        ✅ APLICACION INICIADA EXITOSAMENTE
echo ============================================
echo.
echo 🔒 Servicio corriendo COMPLETAMENTE OCULTO
echo.
echo 🌐 URL de acceso:
echo   🖥️  App: http://localhost:3001
echo.
echo ⚠️  IMPORTANTE:
echo   • El proceso esta oculto e invisible
echo   • Para detenerlo ejecuta: stop.bat
echo.

REM Abrir automáticamente la aplicación
echo 🌐 Abriendo aplicación en el navegador...
timeout /t 2 /nobreak >nul
start http://localhost:3001

echo.
echo ✅ ¡Listo! Tu aplicación del gimnasio está funcionando.
echo.
pause