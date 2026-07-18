@echo off
setlocal
title Listar Teclados Ativos do Notebook

:: ============================================================
::  Lista os teclados ATIVOS (presentes/habilitados) e marca
::  qual e o teclado INTERNO do notebook (PS/2 / ACPI).
:: ============================================================

echo ============================================================
echo   TECLADOS ATIVOS DETECTADOS
echo ============================================================
echo.

powershell -NoProfile -Command ^
  "Get-PnpDevice -Class Keyboard -PresentOnly ^| Where-Object { $_.Status -eq 'OK' } ^| ForEach-Object { $interno = ($_.FriendlyName -match 'PS/2') -or ($_.InstanceId -like 'ACPI\*'); [PSCustomObject]@{ Tipo = $(if ($interno) {'INTERNO'} else {'EXTERNO/HID'}); Status = $_.Status; Nome = $_.FriendlyName; InstanceId = $_.InstanceId } } ^| Format-Table -AutoSize -Wrap"

echo.
echo ------------------------------------------------------------
echo   TODOS os teclados (inclui inativos / Unknown)
echo ------------------------------------------------------------
echo.

powershell -NoProfile -Command ^
  "Get-PnpDevice -Class Keyboard ^| Format-Table Status, FriendlyName, InstanceId -AutoSize -Wrap"

echo.
pause
endlocal
