@echo off
setlocal
cd /d "%~dp0"
title EKG MetaData Explorer inditasa

rem A BAT a projekt gyoker mappajaban legyen.
if exist "backend\main.py" goto project_ok
if exist "ekg-metadata-explorer\backend\main.py" cd /d "%~dp0ekg-metadata-explorer"
if exist "backend\main.py" goto project_ok
echo HIBA: Nem talalom a backend\main.py fajlt.
echo Tedd ezt a BAT fajlt abba a mappaba, ahol a backend es frontend mappak vannak.
pause
exit /b 1

:project_ok
if not exist "frontend\package.json" goto missing_frontend
if not exist "backend\requirements.txt" goto missing_requirements

set /p "EKG_ADMIN_PASSWORD=Adj meg egy helyi admin jelszot (pl. admin123!): "
if not defined EKG_ADMIN_PASSWORD goto empty_password

where py >nul 2>&1
if errorlevel 1 goto missing_python
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node

if exist "backend\.venv\Scripts\python.exe" goto venv_ready
echo Python kornyezet letrehozasa...
py -m venv "backend\.venv"
if errorlevel 1 goto failed

:venv_ready
"backend\.venv\Scripts\python.exe" -c "import fastapi, uvicorn" >nul 2>&1
if not errorlevel 1 goto backend_deps_ready
echo Backend csomagok telepitese...
"backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 goto failed

:backend_deps_ready
if exist "frontend\node_modules" goto frontend_deps_ready
echo Frontend csomagok telepitese - elso alkalommal eltarthat...
pushd "frontend"
call npm.cmd install
if errorlevel 1 goto frontend_install_failed
popd

:frontend_deps_ready
echo.
echo Inditom a backendet es a frontendet kulon ablakban...
start "EKG Backend" /D "%CD%\backend" cmd /k ".venv\Scripts\python.exe -m uvicorn main:app --reload"
start "EKG Frontend" /D "%CD%\frontend" cmd /k "npm.cmd run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173/"
echo.
echo Elinditottam. Hasznalat kozben hagyd nyitva a ket fekete terminalablakot.
pause
exit /b 0

:frontend_install_failed
popd
goto failed

:empty_password
echo HIBA: A jelszo nem lehet ures.
pause
exit /b 1

:missing_frontend
echo HIBA: Nem talalom a frontend\package.json fajlt.
pause
exit /b 1

:missing_requirements
echo HIBA: Nem talalom a backend\requirements.txt fajlt.
pause
exit /b 1

:missing_python
echo HIBA: A Python Launcher (py) nem talalhato. Telepitsd a Python 3-at.
pause
exit /b 1

:missing_node
echo HIBA: Az npm.cmd nem talalhato. Telepitsd a Node.js LTS verziot.
pause
exit /b 1

:failed
echo.
echo HIBA: A fenti parancs hibaval allt le. Olvasd el az uzenetet.
pause
exit /b 1
