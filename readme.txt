usage: cts-win.exe [--help] [--tls] [-p/--port <port>] [-cert <path>] [-key <key>] [-r/--cam <camera id>] [-m/--meta <meta id>]

Argument usage:
   --help, -h        Bring up help menu
   --tls             Enables TLS mode (if this parameter is passed, then cert and key must be provided, otherwise the server works in non-TLS mode)
   --port, -p        Port to listen to
   --cert, -c        Path to root certificate file
   --key, -k         Path to private key file
   --cam, -r         Camera type (0 - Auto, 1 - ADAS, 2 - DUALCAM, 3 - DSM)
   --meta, -m        Metadata (0 - No metadata, 1 - Before file download)

---------------------------------------------------------------------------------------------------------------------------------------------------
Linux release notes:
- Please make sure that FFMPEG is available
---------------------------------------------------------------------------------------------------------------------------------------------------
CHANGELOG
---------------------------------------------------------------------------------------------------------------------------------------------------
0.2.12 - 2024.04.05 - Added unified file transfer for all cameras
0.2.11 - 2024.03.21 - Added enhanced file transfer protocol support
0.2.10 - 2024.01.11 - Fixed MDAS trigger name lookup
                    - Fixed MDAS coodrinates to support negative values
0.2.9 - 2024.01.11 - Fixed invalid DSM driver name parsing in metadata
0.2.8 - 2023.09.06 - Added DIN3 and DIN4 support in metadata
0.2.7 - 2023.08.30 - Improved server stability and CRC error handling
0.2.6 - 2023.05.24 - DSM metadata coordinates changed to signed integer
0.2.5 - 2023.03.28 - Fixed sync issue, added status descriptions
0.2.4 - 2022.11.25 - Fixed ADAS and DSM metadata request sequence
0.2.3 - 2022.11.25 - Added DSM metadata support
0.2.2 - 2022.10.27 - Added DSM footage support
0.2.1 - 2022.10.10 - Added human-readable metadata print
0.2.0 - 2022.10.04 - Improved server stability, prepared the server source to be provided to clients
0.1.4 - 2022.08.22 - Fixed ADAS metadata request
0.1.3 - 2022.08.11 - Added ADAS metadata support
0.1.2 - 2022.06.16 - Updated metadata parsing
0.1.1 - 2022.05.10 - Added DualCam footage metadata support
0.1.0 - 2022.02.25 - Added ADAS footage support
0.0.2 - 2021.06.10 - TLS support + turn off verbose mode
0.0.1 - 2020.06.17 - Initial implementation
