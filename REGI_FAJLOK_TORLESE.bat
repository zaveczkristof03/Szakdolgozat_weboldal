@echo off
REM Phase 0 utan feleslegesse valt regi fajlok torlese.
REM Mindegyikrol van masolat: backend\backups\source-before-phase0-20261125.zip
cd /d "%~dp0"
del /q backend\seed_catalog.py backend\catalog_seed.json backend\fix_chapman_metadata.py backend\update_catalog_metadata.py backend\database.py backend\models.py backend\catalog_metadata_report.md backend\tests\test_catalog.py 2>nul
del /q frontend\src\index.css frontend\src\App.css 2>nul
del /q frontend\src\features\MyResearch.tsx frontend\src\features\ResearchFinder.tsx frontend\src\features\MetadataQuality.tsx 2>nul
del /q frontend\src\assets\hero.png frontend\src\assets\react.svg frontend\src\assets\vite.svg 2>nul
echo Kesz. A regi fajlok torolve.
pause
