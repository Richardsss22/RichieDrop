@echo off
echo ==========================================
echo      RichieDrop Multi-Platform Build
echo ==========================================

echo [1/2] Building for Windows (MSI + EXE)...
call npm run tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Windows build failed!
    pause
    exit /b %errorlevel%
)
echo [SUCCESS] Windows installers created at src-tauri\target\release\bundle\

echo.
echo [2/2] Building for Android (APK)...
echo NOTE: Ensure you have NDK 25.0.1 installed via Android Studio SDK Manager.
echo NOTE: Ensure Developer Mode is ENABLED in Windows Settings.
call npm run tauri android build
if %errorlevel% neq 0 (
    echo [ERROR] Android build failed! Check NDK version and Developer Mode.
    pause
    exit /b %errorlevel%
)
echo [SUCCESS] Android APK created!

echo.
echo ==========================================
echo      ALL BUILDS COMPLETE! 🚀
echo ==========================================
pause
