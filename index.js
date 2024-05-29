const net = require('net');
const commandLineArgs = require('command-line-args');
const tls = require('tls');
const fs = require('fs');
const protocol = require('./protocol.js');
const cliProgress = require('cli-progress');
const _colors = require('colors');
const dbg = require('./debug.js')
const path = require("path");
const { uploadToS3 } = require('./uploadToS3.js');
const {Server} = require("socket.io")
const { exec } = require("child_process");
const { ConvertVideoFile } = require('./ConvertVideoFile.js');
process.setMaxListeners(12);
 const io= new Server({cors:{origin:"*"}})
var deviceConnections =[]
dbg.logAndPrint("Camera Transfer Server (Copyright © 2022, \x1b[34mTeltonika\x1b[0m), version 0.2.12");
const optionDefinitions = [
    { name: 'help', alias: 'h', type: Boolean },
    { name: 'tls', alias: 't', type: Boolean },
    { name: 'port', alias: 'p', type: Number },
    { name: 'cert', alias: 'c' },
    { name: 'key', alias: 'k' },
    { name: 'cam', alias: 'r', type: Number },
    { name: 'meta', alias: 'm', type: String },
]
const args = commandLineArgs(optionDefinitions);
if (args.help == true) {
    dbg.logAndPrint(`usage: cts-win.exe [-h/--help] [--tls] [-p/--port <port>] [-c/--cert <path>] [-k/--key <key>] [-r/--cam <camera id>] [-m/--meta <meta id>]
    Argument usage:
       --help, -h        Bring up help menu
       --tls             Enables TLS mode (if this parameter is passed, then cert and key must be provided, otherwise the server works in non-TLS mode)
       --port, -p        Port to listen to
       --cert, -c        Path to root certificate file
       --key, -k         Path to private key file
       --cam, -r         Camera type (0 - Auto, 1 - ADAS, 2 - DualCam, 3 - DSM)
       --meta, -m        Metadata (0 - No metadata, 1 - Before file download)`
       );
    process.exit();
}
/* Check arguments for port */
let port = 0;
if (args.port > 0) {
    port = args.port;
} else {
    dbg.error("Port provided incorrectly / not provided in arguments!");
    process.exit();
}
let camera_option = 0;
if (typeof(args.cam) != "undefined") {
    if (args.cam >= 0 && args.cam < protocol.camera_type.LAST) {
        if (args.cam == protocol.camera_type.DUALCAM) {
            dbg.logAndPrint("Chosen DualCam camera type");
        }
        camera_option = args.cam;
    } else {
        dbg.error("Camera type provided incorrectly! " + args.cam);
        process.exit();
    }
} else {
    dbg.logAndPrint("No camera type chosen. Defaulting to auto camera type detection");
}
let metadata_option = 0;
if (typeof(args.meta) != "undefined") {
    if (args.meta == 0 || args.meta == 1) {
        if (args.meta == 0) {
            metadata_option = protocol.metadata_type.NO_METADATA;
            dbg.logAndPrint("No metadata requests will be made");
        }
        if (args.meta == 1) {
            metadata_option = protocol.metadata_type.AT_START;
            dbg.logAndPrint("Metadata will be requested at the start of the file transfer");
        }
    } else {
        dbg.error("Metadata request parameter provided incorrectly!");
        process.exit();
    }
} else {
    dbg.logAndPrint("No metadata requests will be made");
}
let server;
if (args.tls && typeof args.key !== "undefined" && typeof args.cert !== "undefined") {
    dbg.logAndPrint('Starting TLS mode');
    var options = {
        key: fs.readFileSync(args.key),
        cert: fs.readFileSync(args.cert),
    };
    server = tls.createServer(options, handleConnection);
} else {
    dbg.logAndPrint('Starting REGULAR mode');
    var options;
    server = net.createServer(options, handleConnection);
}
//  Start listening to port
server.listen(port, function () {
    dbg.logAndPrint('Listening to ' + server.address()["port"] + ' port');
});
io.listen(server)
io.on("connection",(socket)=>{
    console.log("Socket connections created by ",socket.id)

})
exports.emitdatatoSocket=(payload)=>{
const {clientId} = payload
io.fetchSockets().then((sockets)=>{
    sockets.forEach((socket)=>{
       if( clientId==socket.handshake.query.clientId){
        socket.emit("message",payload)
       }
        

    })

})

}
//  Network handler
const buffer_size = 20000;
function handleConnection(connection) {
    const progress_bar = new cliProgress.SingleBar({
        format: '[\x1b[34mSERVER\x1b[0m] Download Progress |' + _colors.blue('{bar}') + '| {percentage}% || {value}/{total} Chunks || ETA: {eta} seconds',
        barsize: 30,
        hideCursor: true
    }, cliProgress.Presets.shades_grey);
    let tcp_buffer = Buffer.alloc(0);
    let remoteAddress = connection.remoteAddress + ':' + connection.remotePort;
    let current_state = protocol.fsm_state.INIT;
    let cmd_size = 0;
    let cmd_id = 0;
    let device_info = new protocol.DeviceDescriptor();
    let metadata = new protocol.MetaDataDescriptor();
    dbg.logAndPrint('Client connected: ' + remoteAddress);
    connection.on('data', onConnData);
    connection.once('close', onConnClose);
    connection.on('error', onConnError);
    connection.on('timeout', onConnTimeout);
    function repeatSyncRequest() {
        current_state = protocol.run_fsm(protocol.fsm_state.REPEAT_PACKET, connection, cmd_id.NONE, tcp_buffer, device_info, metadata, progress_bar, camera_option, metadata_option);
    }    
    function lookForSyncPacket(data) {
        let indexOfSync = data.toString('hex').indexOf("00030004");
        if (indexOfSync > 0) {
            data = data.slice(indexOfSync / 2, data.length);
        }
        return data
    }
    function getUnixTimestamp(dateString) {
        return new Date(dateString).getTime();
      }

    
    function onConnData(data) {
        // Check if there is a TCP buffer overflow
        if (data.length >= buffer_size) {
            dbg.error("Too much data: " + data.length + " >= " + buffer_size);
            return;
        }
        if (current_state == protocol.fsm_state.REPEAT_PACKET) {
            // try string search the sync cmd and drop unsynced packet data
            data = lookForSyncPacket(data);
            cmd_id = protocol.ParseCmd(data);
            if (cmd_id != protocol.cmd_id.SYNC) {
                dbg.log("Waiting for sync, cmd id: " + cmd_id);
                dbg.log("[RX]: [" + data.toString('hex') + "]");
                let repeat_interval = (device_info.repeat_count > 9) ? 4000 : 2000;
                if ((Date.now() - device_info.repeat_sent_ts) > repeat_interval) {
                    repeatSyncRequest();
                }
                return;
            } else {
                tcp_buffer = Buffer.alloc(0);
            }
        }
        // Add new data to buffer
        tcp_buffer = Buffer.concat([tcp_buffer, data]);
        // A loop to handle case where a packet contains more than one command
        repeat_cycle = true;
        while (repeat_cycle == true) {
            repeat_cycle = false;
            if (tcp_buffer.length < 4) {
                dbg.log("Invalid received data len: " + tcp_buffer.length);
                return;
            }
            // Log RX buffer contents
            dbg.log("[RX]: [" + tcp_buffer.toString('hex') + "]");
            // Check CMD validity
            cmd_id = protocol.ParseCmd(tcp_buffer);
            if (protocol.IsCmdValid(cmd_id) == false) {
                dbg.log("Invalid CMD ID: " + cmd_id);
                tcp_buffer = Buffer.alloc(0);
                return;
            }
            // Get CMD data size
            if (protocol.CmdHasLengthField(cmd_id) == true) {
                cmd_size = tcp_buffer.readUInt16BE(2) + 4;
            } else {
                cmd_size = protocol.GetExpectedCommandLength(cmd_id);
            }
            // If there is not enough data for buffer - return and wait another TCP packet
            if (tcp_buffer.length < cmd_size) {
                return;
            }
            current_state = protocol.run_fsm(current_state, connection, cmd_id, tcp_buffer, device_info, metadata, progress_bar, camera_option, metadata_option);
            if (current_state == protocol.fsm_state.REPEAT_PACKET) {
                tcp_buffer = Buffer.alloc(0);
            } else {
                dbg.log("Invalid CMD ID: " + cmd_id);
                tcp_buffer = tcp_buffer.slice(cmd_size, tcp_buffer.length);
                repeat_cycle = true;
            }
        }
    }
    function onConnClose() {
       // dbg.logAndPrint('Connection from ' + remoteAddress + ' closed');
       console.log("onConnClose", device_info.getUploadedToS3())
       let timestamp = getUnixTimestamp(metadata.timestamp);
       console.log("timestamp",timestamp)
       const IMEI = device_info.getDeviceDirectory(); // IMEI number
       const filename = `${timestamp}` + ".mp4"; // filename
       
       // Construct the path to the file
       const filePath = path.join(__dirname, IMEI, filename);
       if (device_info.getUploadedToS3() ==false && !isNaN(timestamp)  && !fs.existsSync(filePath) ){console.log("in")
     /*   const IMEI = device_info.getDeviceDirectory(); // IMEI number
       const filename = `${timestamp}` + ".mp4"; // filename
       
       // Construct the path to the file
       const filePath = path.join(__dirname, 'downloads', IMEI, filename);
                  
       if (device_info.getUploadedToS3() ==false && !fs.existsSync(filePath) ) {
         console.log("onConnError 4513")
         const query = Buffer.from([0, 0, 0, 0]);
         dbg.log('[TX]: [' + query.toString('hex') + ']');
         connection.write(query);
 
         console.log("DSvsdf onConnError 2", device_info.getExtension()) */
         var fileName;
        var dateValue = new Date();
        var fileType = 1;
        if (device_info.getExtension() == ".h265") {
          fileName =  `${timestamp}` + ".mp4";
          fileType = 2;
        } else {
          fileName =
          `${timestamp}` + device_info.getExtension();
          fileType = 1;
        }
        let deviceInfo = device_info.getDeviceDirectory();
        let directory = deviceInfo.split('/').pop();
        let params ;
        let temp_file_buff = Buffer.alloc(0);
        temp_file_buff = Buffer.concat([temp_file_buff, device_info.getFileBuffer()]);
        if(device_info.getExtension() ==
        ".h265"){

          params = {
            Bucket: "vtracksolutions/media", // pass your bucket name
            Key:
            directory +
                "/" +
                `${timestamp}` +
                
                 ".mp4",                      

            // Body: fileContent,
            ContentType: "video/mp4",
          };
        }else{

          params = {
            Bucket: "vtracksolutions/media", // pass your bucket name
            Key:
            directory +
                "/" +
                `${timestamp}` +
                device_info.getExtension(),

           // Body: temp_file_buff,
            ContentType: 'image/jpeg' 
            
          };
        } 
        if (device_info.getExtension() == ".h265") {

            ConvertVideoFile(
            device_info.getDeviceDirectory(),
            `${timestamp}`,
            device_info.getExtension()
          ).then((d)=>{
           
            const IMEI = device_info.getDeviceDirectory(); // IMEI number
const filename = `${timestamp}` + ".mp4"; // filename

// Construct the path to the file
var filePath = path.join(__dirname, IMEI, filename);
            const fileContent = fs.readFileSync(filePath);
  params.Body=fileContent
        //    console.log("uploading start", fileContent);
        let deviceInfo = device_info.getDeviceDirectory();
        let directory = deviceInfo.split('/').pop();
       
      /*  uploadToS3(params,{fileType,fileName,deviceIMEI:directory})
           device_info.setUploadedToS3(true);
           fs.unlink(filePath, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            } else {
                console.log("File deleted successfully");
            }
        }); */
        
        uploadToS3(params,{fileType,fileName,deviceIMEI:directory})
    .then((result) => {
        device_info.setUploadedToS3(true);
        fs.unlink(filePath, (err) => {
         if (err) {
             console.error("Error deleting file:", err);
         } else {
             console.log("File deleted successfully");
         }
     })
    })
    .catch((error) => {
        console.error(error);
    });
       
       
            })

            
       
        }else{
            const IMEI = device_info.getDeviceDirectory(); // IMEI number
            const filename = `${timestamp}` + device_info.getExtension(); // filename
            
            // Construct the path to the file
            const filePath = path.join(__dirname, IMEI, filename);
                        const fileContent = fs.readFileSync(filePath);
              params.Body=fileContent
            let deviceInfo = device_info.getDeviceDirectory();
            let directory = deviceInfo.split('/').pop();
            
                   /*  uploadToS3(params,{fileType,fileName,deviceIMEI:directory});   
       device_info.setUploadedToS3(true);  */  
       uploadToS3(params,{fileType,fileName,deviceIMEI:directory})
       .then((result) => {
           device_info.setUploadedToS3(true);
           fs.unlink(filePath, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            } else {
                console.log("File deleted successfully");
            }
        })
       })  
      
        }}
    }
    function onConnError(err) {
        dbg.logAndPrint('Connection ' + remoteAddress + ' error: ' + err.message);
        console.log("onConnError")
    }
    function onConnTimeout() {
        dbg.logAndPrint('Connection from ' + remoteAddress + ' timeouted');
        console.log("onConnTimeout")
    }
}
