# Camera footage download server

A tool used to receive footage from cameras connected to FM devices.

## Installation for development

1. Get node.js from https://nodejs.org/en/download/ 
Be sure to mark "Automatically install the necessary tools" box

2. After installation is complete open the project and run setup.bat

3. Release can be done by running generate_realease.bat. A zip archive with required files will appear in _build_ folder.

## Usage 

On windows change port inside run_server.bat and run it or use command prompt:
```
cts-win.exe [--help] [--tls] [-p/--port <port>] [-cert <path>] [-key <key>] [-r/--cam <camera id>] [-m/--meta <meta id>]
```
Argument usage:
```
   --help, -h        Bring up help menu
   --tls             Enables TLS mode (if this parameter is passed, then cert and key must be provided, otherwise the server works in non-TLS mode)
   --port, -p        Port to listen to
   --cert, -c        Path to root certificate file
   --key, -k         Path to private key file
   --cam, -r         Camera type (0 - Auto, 1 - ADAS, 2 - DUALCAM, 3 - DSM)
   --meta, -m        Metadata (0 - No metadata, 1 - Before file download)
```
