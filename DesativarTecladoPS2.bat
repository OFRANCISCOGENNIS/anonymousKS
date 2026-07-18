@echo off
setlocal
title Desativar Teclado Padrao PS/2

:: ============================================================
::  Desativa APENAS o "Teclado Padrao PS/2" (interno do notebook).
::  Requer privilegios de ADMINISTRADOR.
::  Para reativar, use o TogglarTecladoNotebook.bat.
:: ============================================================

:: --- Verifica / solicita elevacao de administrador ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando privilegios de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Desativando o Teclado Padrao PS/2 ...
echo.

powershell -NoProfile -Command ^
  "Get-PnpDevice -Class Keyboard ^| Where-Object { ($_.FriendlyName -match 'PS/2') -or ($_.InstanceId -like 'ACPI\*') } ^| ForEach-Object { Write-Host ('-> ' + $_.FriendlyName); Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"

echo.
echo Teclado interno PS/2 DESATIVADO.
echo (Rode o TogglarTecladoNotebook.bat para reativar.)
echo.
pause
endlocal
