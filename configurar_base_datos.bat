@echo off
title Configurar Base de Datos - Punto Escolar
echo ===================================================
echo   CONFIGURADOR AUTOMATICO DE BASE DE DATOS
echo ===================================================
echo.

:: Verificar si Node.js esta instalado
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor, instala Node.js antes de configurar la base de datos.
    pause
    exit /b 1
)

echo [1/3] Creando base de datos 'punto_escolar' si no existe...
:: Crear la base de datos usando npx prisma db push o interactuando con mysql si esta en el PATH
:: Prisma migrate dev creara la base de datos automaticamente si no existe
cd backend
call npx prisma migrate dev --name init

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo conectar a MySQL. Asegurate de que:
    echo 1. MySQL Server 8 esta instalado y corriendo.
    echo 2. El usuario es 'root' y la contrasena es 'toor'.
    echo 3. El puerto es el 3306.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Generando Prisma Client...
call npx prisma generate

echo.
echo [3/3] Poblando base de datos con datos semilla (admin, productos, listas)...
call node prisma/seed.js

echo.
echo ===================================================
echo   CONFIGURACION COMPLETADA EXITOSAMENTE
echo   La base de datos 'punto_escolar' esta lista.
echo ===================================================
echo.
pause
