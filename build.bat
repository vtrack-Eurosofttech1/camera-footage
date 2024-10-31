@ECHO OFF
pkg --prod --max-old-space-size=3072 --targets node12-windows-x64,node12-linux "./"