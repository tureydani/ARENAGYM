@echo off
echo ============================================
echo        🛑 DETENIENDO GIMNASIO APP
echo ============================================
echo.

echo 🔄 Deteniendo todos los procesos Node.js...
taskkill /f /im node.exe >nul 2>&1

echo 🔄 Deteniendo procesos CMD relacionados...
for /f "tokens=2" %%i in ('tasklist /fi "windowtitle eq Gimnasio*" /fo csv ^| find /v "PID"') do (
    taskkill /f /pid %%i >nul 2>&1
)

echo 🔍 Liberando puertos específicos...
REM Matar procesos en puerto 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /f /pid %%a >nul 2>&1
)

REM Matar procesos en puerto 3001  
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo 📊 Verificando puertos...
echo.
echo 🔧 Puerto 3000 (Backend):
netstat -ano | findstr :3000
if errorlevel 1 (
    echo   ✅ Puerto 3000 LIBRE
) else (
    echo   ⚠️  Puerto 3000 aún en uso
)

echo.
echo 🖥️ Puerto 3001 (Frontend):
netstat -ano | findstr :3001
if errorlevel 1 (
    echo   ✅ Puerto 3001 LIBRE
) else (
    echo   ⚠️  Puerto 3001 aún en uso
)

echo.
echo ============================================
echo        ✅ SERVICIOS DETENIDOS CORRECTAMENTE
echo ============================================
echo.
echo 🔒 Todos los servicios (incluidos los ocultos) han sido detenidos.
echo.
echo 💡 Para volver a iniciar: start-hidden.bat
echo 💡 Para configurar inicio automático: configurar-inicio-automatico.bat
echo.

pause