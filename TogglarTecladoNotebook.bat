@echo off
setlocal enabledelayedexpansion
title Ativar/Desativar Teclado do Notebook

:: ============================================================
::  Alterna (liga/desliga) o teclado interno do notebook.
::  Requer privilegios de ADMINISTRADOR.
::  Nao afeta teclados USB externos (apenas o PS/2 / ACPI interno).
:: ============================================================

:: --- Verifica / solicita elevacao de administrador ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando privilegios de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo   TECLADO INTERNO DO NOTEBOOK - ATIVAR / DESATIVAR
echo ============================================================
echo.

:: Filtro dos teclados internos (PS/2 e ACPI). Ignora teclados USB.
set "FILTRO=($_.Class -eq 'Keyboard') -and ($_.InstanceId -match 'ACPI\\\\|\\bPS/2\\b|\\\\PS2') -and ($_.InstanceId -notmatch 'USB')"

:: --- Descobre estado atual ---
for /f "delims=" %%S in ('powershell -NoProfile -Command ^
    "$d = Get-PnpDevice ^| Where-Object { %FILTRO% } ^| Select-Object -First 1; if ($d) { $d.Status } else { 'NAOENCONTRADO' }"') do set "STATUS=%%S"

if "%STATUS%"=="NAOENCONTRADO" (
    echo Nenhum teclado interno PS/2/ACPI foi localizado.
    echo Listando todos os teclados detectados:
    echo.
    powershell -NoProfile -Command "Get-PnpDevice -Class Keyboard | Format-Table Status, FriendlyName, InstanceId -AutoSize"
    echo.
    pause
    exit /b 1
)

echo Estado atual do teclado interno: %STATUS%
echo.

if /i "%STATUS%"=="OK" (
    echo Desativando o teclado interno...
    powershell -NoProfile -Command ^
        "Get-PnpDevice ^| Where-Object { %FILTRO% } ^| Disable-PnpDevice -Confirm:$false"
    echo Teclado interno DESATIVADO.
) else (
    echo Ativando o teclado interno...
    powershell -NoProfile -Command ^
        "Get-PnpDevice ^| Where-Object { %FILTRO% } ^| Enable-PnpDevice -Confirm:$false"
    echo Teclado interno ATIVADO.
)

echo.
pause
endlocal
