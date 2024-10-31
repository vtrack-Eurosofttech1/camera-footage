@ECHO OFF
cmd /c build.bat
7za.exe a -tzip "./build/camera-footage-download-server-source.zip" cts-win.exe cts-linux ffmpeg.exe readme.txt run_server.bat index.js package.json package-lock.json protocol.js setup.bat build.bat debug.js 7za.exe