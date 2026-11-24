@echo off
chcp 65001 >nul
cd /d "%~dp0"
title SGO Ancora - teste local

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao encontrado.
  echo  Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if exist ".env" goto deps

echo.
echo  ==== Primeira vez: conexao com o PostgreSQL ====
echo.
set PGSENHA=
set /p PGSENHA= Senha do usuario "postgres" (a que voce definiu ao instalar o PostgreSQL): 
set PGPORTA=5432
set /p PGPORTA= Porta do PostgreSQL [Enter = 5432]: 
(
  echo PGHOST=127.0.0.1
  echo PGPORT=%PGPORTA%
  echo PGUSER=postgres
  echo PGPASSWORD=%PGSENHA%
  echo PGDATABASE=postgres
  echo SGO_ARQUIVOS_DIR=data/arquivos
  echo OMIE_APPS=
) > .env
echo  Arquivo .env criado.

:deps
if exist "node_modules" goto rodar
echo.
echo  ==== Instalando as dependencias (so na primeira vez, leva alguns minutos) ====
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo  Falha ao instalar as dependencias.
  pause
  exit /b 1
)

:rodar
echo.
echo  ==== SGO Ancora rodando em https://localhost:8080 ====
echo  Usuario: superadmin   Senha: trocar123  (troque no primeiro acesso)
echo  O navegador vai avisar que o certificado nao e confiavel: clique em
echo  "Avancado" e depois em "Continuar para localhost".
echo  Para parar, feche esta janela.
echo.
start "" cmd /c "timeout /t 15 >nul & start https://localhost:8080/login"
call npm run dev
pause
