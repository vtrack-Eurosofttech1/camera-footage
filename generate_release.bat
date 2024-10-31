@ECHO OFF
cmd /c build.bat
7za.exe a -tzip "./build/camera-footage-download-server.zip" cts-win.exe cts-linux ffmpeg.exe readme.txt run_server.bat