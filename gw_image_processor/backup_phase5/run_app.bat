@echo off
cd /d "%~dp0"
title G^&W Pixel Lab - Local Server
color 0B
echo ===================================================
echo     KHOI DONG G^&W PIXEL LAB - LOCAL SERVER
echo ===================================================
echo.
echo [*] Dang mo trinh duyet...
start http://localhost:8080/
echo [*] Server dang chay tren may nay tai: http://localhost:8080/
echo.
echo [*] DE CHIA SE CHO NGUOI KHAC TRUY CAP (CHUNG MANG WIFI/LAN):
for /f "tokens=14" %%i in ('ipconfig ^| findstr IPv4') do set IP=%%i
if "%IP%"=="" set IP=Dia_chi_IP_cua_may_nay
echo     -^> Mo trinh duyet tren dien thoai/may khac va nhap:
echo     -^> http://%IP%:8080
echo.
echo [*] De TAT ung dung, dong cua so cmd nay (hoac nhan Ctrl+C).
echo.
python -m http.server 8080 --bind 0.0.0.0
pause
