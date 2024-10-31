const net = require("net");
const commandLineArgs = require("command-line-args");
const tls = require("tls");
const fs = require("fs");
// const protocol = require("./protocol.js");
const protocol = require("./protocol2.js");
const cliProgress = require("cli-progress");
const _colors = require("colors");
const dbg = require("./debug.js");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { exec } = require("child_process");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");
const emitdatatoSocket = require("./socket.js");
const { checkVideoPlayback, videoConversion } = require("./nn.js");
process.setMaxListeners(12);

/* dbg.logAndPrint(
  "Camera Transfer Server (Copyright © 2022, \x1b[34mTeltonika\x1b[0m), version 0.2.12"
); */ //"dev": "nodemon index.js -p 7056 -r 2 -m 1", "dev": "nodemon index.js --tls -p 7056 -c ./certs/server_cert.pem -k ./certs/server_key.pem -r 2 -m 1"
const optionDefinitions = [
    { name: "help", alias: "h", type: Boolean },
    { name: "tls", alias: "t", type: Boolean },
    { name: "port", alias: "p", type: Number },
    { name: "cert", alias: "c" },
    { name: "key", alias: "k" },
    { name: "cam", alias: "r", type: Number },
    { name: "meta", alias: "m", type: String }
  ];
  const args = commandLineArgs(optionDefinitions);
  if (args.help == true) {
   /*  dbg.logAndPrint(`usage: cts-win.exe [-h/--help] [--tls] [-p/--port <port>] [-c/--cert <path>] [-k/--key <key>] [-r/--cam <camera id>] [-m/--meta <meta id>]
      Argument usage:
         --help, -h        Bring up help menu
         --tls             Enables TLS mode (if this parameter is passed, then cert and key must be provided, otherwise the server works in non-TLS mode)
         --port, -p        Port to listen to
         --cert, -c        Path to root certificate file
         --key, -k         Path to private key file
         --cam, -r         Camera type (0 - Auto, 1 - ADAS, 2 - DualCam, 3 - DSM)
         --meta, -m        Metadata (0 - No metadata, 1 - Before file download)`); */
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
  if (typeof args.cam != "undefined") {
    if (args.cam >= 0 && args.cam < protocol.camera_type.LAST) {
      if (args.cam == protocol.camera_type.DUALCAM) {
       // dbg.logAndPrint("Chosen DualCam camera type");
      }
      camera_option = args.cam;
    } else {
      dbg.error("Camera type provided incorrectly! " + args.cam);
      process.exit();
    }
  } else {
    /* dbg.logAndPrint(
      "No camera type chosen. Defaulting to auto camera type detection"
    ); */
  }
  let metadata_option = 0;
  if (typeof args.meta != "undefined") {
    if (args.meta == 0 || args.meta == 1) {
      if (args.meta == 0) {
        metadata_option = protocol.metadata_type.NO_METADATA;
      //  dbg.logAndPrint("No metadata requests will be made");
      }
      if (args.meta == 1) {
        metadata_option = protocol.metadata_type.AT_START;
      //   dbg.logAndPrint(
      //     "Metadata will be requested at the start of the file transfer"
      //   );
      }
    } else {
      dbg.error("Metadata request parameter provided incorrectly!");
      process.exit();
    }
  } else {
   // dbg.logAndPrint("No metadata requests will be made");
  }
  let server;
  if (
    args.tls &&
    typeof args.key !== "undefined" &&
    typeof args.cert !== "undefined"
  ) {
   // dbg.logAndPrint("Starting TLS mode");
   console.log("Starting TLS mode")
    var options = {
      key: fs.readFileSync(args.key),
      cert: fs.readFileSync(args.cert)
    };
    server = tls.createServer(options, handleConnection);
  } else {
   /// dbg.logAndPrint("Starting REGULAR mode");
  
   console.log("Starting REGULAR mode")
    var options;
    server = net.createServer(options, handleConnection);
  }
  //  Start listening to port
  server.listen(port, function () {
   // dbg.logAndPrint("Listening to " + server.address()["port"] + " port");
  });
  
//  Network handler
const buffer_size = 200000;
function handleConnection(connection) {
  const progress_bar = new cliProgress.SingleBar(
    {
      format:
        "[\x1b[34mSERVER\x1b[0m] Download Progress |" +
        _colors.blue("{bar}") +
        "| {percentage}% || {value}/{total} Chunks || ETA: {eta} seconds",
      barsize: 30,
      hideCursor: true
    },
    cliProgress.Presets.shades_grey
  );
  let tcp_buffer = Buffer.alloc(0);
  let remoteAddress = connection.remoteAddress + ":" + connection.remotePort;
  let current_state = protocol.fsm_state.INIT;
  let cmd_size = 0;
  let cmd_id = 0;
  let device_info = new protocol.DeviceDescriptor();
  let metadata = new protocol.MetaDataDescriptor();
  let lastActivityTime = Date.now(); 
  dbg.logAndPrint("Client connected: " + remoteAddress);
  const INACTIVITY_TIMEOUT = 30000; 

  // Timer to check inactivity
  const inactivityTimer = setInterval(() => {
    if (Date.now() - lastActivityTime > INACTIVITY_TIMEOUT) {
      
      connection.destroy(); // Close the connection
      clearInterval(inactivityTimer); // Clear the interval timer
    }
  }, 1000); // Check every second
  connection.on("data", onConnData);
  connection.once("close", onConnClose);
  connection.on("error", onConnError);
  connection.on("timeout", onConnTimeout);
  function repeatSyncRequest() {
    
    current_state = protocol.run_fsm(
      protocol.fsm_state.REPEAT_PACKET,
      connection,
      cmd_id.NONE,
      tcp_buffer,
      device_info,
      metadata,
      progress_bar,
      camera_option,
      metadata_option
    );
  }
  function lookForSyncPacket(data) {
    let indexOfSync = data.toString("hex").indexOf("00030004");
    if (indexOfSync > 0) {
      data = data.slice(indexOfSync / 2, data.length);
    }
    return data;
  }
let packetData = {
  packetCount: 0,
  packets: []
};

function formatBufferToHex(buffer) {

  const hexString = buffer.toString('hex');
  return hexString.match(/.{1,2}/g).join(',');
}


  function onConnData(data) {
    lastActivityTime = Date.now();
//       const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data);

//       const dataLength = bufferData.length;
//       packetData.packetCount++;
//   const currentTime = Date.now();
//   const formattedHex = formatBufferToHex(bufferData);
//   packetData.packets.push({
//     length: dataLength,
//     data: formattedHex,
//     time: currentTime 
//   });
  
//   try {
//     fs.writeFileSync(path.join(__dirname, 'packetData2.json'), JSON.stringify(packetData, null, 2));
//   } catch (error) {
//     console.log("Error writing to file:", error);
//   }
    


    if (current_state == protocol.fsm_state.REPEAT_PACKET) {
       

      data = lookForSyncPacket(data);
      cmd_id = protocol.ParseCmd(data);
      if (cmd_id != protocol.cmd_id.SYNC) {

        let repeat_interval = device_info.repeat_count > 9 ? 4000 : 2000;
        if (Date.now() - device_info.repeat_sent_ts > repeat_interval) {
          
          repeatSyncRequest();
        }
        return;
      } else {
        tcp_buffer = Buffer.alloc(0);
      }
    }
    
    tcp_buffer = Buffer.concat([tcp_buffer, data]);
    let loopCounter = 0;
    repeat_cycle = true;
    while (repeat_cycle == true) {
      loopCounter++;
      repeat_cycle = false;
      if (tcp_buffer.length < 4) {
        return;
      }
      cmd_id = protocol.ParseCmd(tcp_buffer);
      if (protocol.IsCmdValid(cmd_id) == false) {
        tcp_buffer = Buffer.alloc(0);
        return;
      }
      if (protocol.CmdHasLengthField(cmd_id) == true) {
        cmd_size = tcp_buffer.readUInt16BE(2) + 4;
      } else {
        cmd_size = protocol.GetExpectedCommandLength(cmd_id);
      }

      if (tcp_buffer.length < cmd_size) {
      
        return;
      }
      current_state = protocol.run_fsm(
        current_state,
        connection,
        cmd_id,
        tcp_buffer,
        device_info,
        metadata,
        progress_bar,
        camera_option,
        metadata_option
      );
      if (current_state == protocol.fsm_state.REPEAT_PACKET) {
     
        tcp_buffer = Buffer.alloc(0);
      } else {
        tcp_buffer = tcp_buffer.slice(cmd_size, tcp_buffer.length);
        repeat_cycle = true;
      }
    }
    console.log(`Loop ran ${loopCounter} times.`); 
  }

  
//   function onConnClose() {
//     clearInterval(inactivityTimer);
//     // dbg.logAndPrint('Connection from ' + remoteAddress + ' closed');
//     console.log("onConnClose", device_info.getUploadedToS3() )//, device_info.getsavedHalfData());
//     // let timestamp = 
//     // let sendedData = {
//     //   clientId: device_info.getclientId(),
//     //   vehicle: device_info.getvehicle(),
//     //   timestamp: device_info.newtimestamp(),
//     //   progress: 100,
//     //   message: "Device is not sending data or camera is off!! Downloaded file is uploaded"
//     // }
//     const startIndex = metadata.timestamp.indexOf('(') + 1;
// const endIndex = metadata.timestamp.indexOf(')');
//     let timestamp = parseInt(metadata.timestamp.substring(startIndex, endIndex), 10);
//     // getUnixTimestamp(metadata.timestamp);
   
//     console.log("timestamp", timestamp)
//     const IMEI = device_info.getDeviceDirectory(); // IMEI number
//     const filename = `${timestamp}` + ".mp4"; // filename
//     var frameratevideo = metadata.framerate
//     // Construct the path to the file
//     //timestamp = NaN
//     const filePath = path.join(__dirname, IMEI, filename);
//     // if(timestamp > Date.now() || isNaN(timestamp)){
//     //   console.log("clos2")
//     //   const query = Buffer.from([0, 0, 0, 0]);
//     //   ///  dbg.log("[TX]: [" + query.toString("hex") + "]");
//     //     connection.write(query);
//     //    return ;
//     // }
//     console.log("cloze",  device_info.getUploadedToS3() == false,
//     !isNaN(timestamp) ,
//     !fs.existsSync(filePath))
//     if (
//       device_info.getUploadedToS3() == false &&
//       !isNaN(timestamp) &&
//       !fs.existsSync(filePath)
//     ) {
//       console.log("in");      
//       var fileName;
//       var dateValue = new Date();
//       var fileType = 1;
//       if (device_info.getExtension() == ".h265") {
//         fileName = `${timestamp}` + ".mp4";
//         fileType = 2;
//       } else {
//         fileName = `${timestamp}` + device_info.getExtension();
//         fileType = 1;
//       }
//       let deviceInfo = device_info.getDeviceDirectory();
//       let directory = deviceInfo.split("/").pop();
//       let params;
//       let temp_file_buff = Buffer.alloc(0);
//       temp_file_buff = Buffer.concat([
//         temp_file_buff,
//         device_info.getFileBuffer()
//       ]);
//       if (device_info.getExtension() == ".h265") {
//         params = {
//           Bucket: "vtracksolutions/media", // pass your bucket name
//           Key: directory + "/" + `${timestamp}` + ".mp4",

//           // Body: fileContent,
//           ContentType: "video/mp4"
//         };
//       } else {
//         params = {
//           Bucket: "vtracksolutions/media", // pass your bucket name
//           Key: directory + "/" + `${timestamp}` + device_info.getExtension(),

//           // Body: temp_file_buff,
//           ContentType: "image/jpeg"
//         };
//       }
//       console.log(params,"09999")
//       if (device_info.getExtension() == ".h265") {
        
//         console.log("camrea", device_info.getDeviceDirectory(),
//         frameratevideo,
//         `${timestamp}`,
//         device_info.getExtension())
//         ConvertVideoFile(
//           device_info.getDeviceDirectory(),
//           frameratevideo,
//           `${timestamp}`,
       
//           device_info.getExtension()
//         ).then(async (d) => {

//           /* 
//           old code
//                     const IMEI = device_info.getDeviceDirectory(); // IMEI number
//           const filename = `${timestamp}` + ".mp4"; // filename
//           let cameraType =  device_info.getFileToDL()
//           // Construct the path to the file
//           var filePath = path.join(__dirname, IMEI, filename);
//         let fileContent;
//           try{
//            fileContent = fs.readFileSync(filePath);}catch(e){
//             console.log(e.message)
//           }
//           params.Body = fileContent;
//           //    console.log('uploading start', fileContent);
//           let deviceInfo = device_info.getDeviceDirectory();
//           let directory = deviceInfo.split("/").pop();
         
          
//         console.log("asdfcsd2", params, {
//           fileType,
//           fileName,
//           deviceIMEI: directory,
//           filePath,
//           cameraType})
//         uploadToS3(params, {
//           fileType,
//           fileName,
//           deviceIMEI: directory,
//           filePath,
//           cameraType,
//         });
//         device_info.setUploadedToS3(true);
       
//         emitdatatoSocket(device_info.getsavedHalfData())
//         }).catch(error => {
//           console.log("Error converting or uploading:222", error);
//         });
//           */

//           var IMEI = device_info.getDeviceDirectory(); // IMEI number
//           var filename = `${timestamp}` + ".mp4"; // filename
//           var cameraType =  device_info.getFileToDL()

//           const filePathnew = path.join(__dirname, IMEI, filename);
// console.log("d", filePathnew);
//          await checkVideoPlayback(filePathnew)
//     .then(() => {
//         console.log('Video is playable.');
       
//           // Construct the path to the file
//           var filePath = path.join(__dirname, IMEI, filename);
//         let fileContent;
//           try{
//            fileContent = fs.readFileSync(filePath);}catch(e){
//             console.log(e.message)
//           }
//           params.Body = fileContent;
//           //    console.log('uploading start', fileContent);
//           let deviceInfo = device_info.getDeviceDirectory();
//           let directory = deviceInfo.split("/").pop();
         
//           /*  uploadToS3(params,{fileType,fileName,deviceIMEI:directory})
//            device_info.setUploadedToS3(true);
//            fs.unlink(filePath, (err) => {
//             if (err) {
//                 console.error('Error deleting file:', err);
//             } else {
//                 console.log('File deleted successfully');
//             }
//         }); */
//         console.log("asdfcsd2", params, {
//           fileType,
//           fileName,
//           deviceIMEI: directory,
//           filePath,
//           cameraType})
//         uploadToS3(params, {
//           fileType,
//           fileName,
//           deviceIMEI: directory,
//           filePath,
//           cameraType,
//         });
//         device_info.setUploadedToS3(true);
//        // console.log("dsdsfds", sendedData)
//         emitdatatoSocket(device_info.getsavedHalfData())
//         }).catch(error => {
//           console.log("Error converting or uploading:222", error);
//         });
//       })
//       .catch((error) => {
//           console.log("video play error",error.message);
//           let deviceInfo = device_info.getDeviceDirectory();
//           let imei = deviceInfo.split("/").pop();
//           const file1Path = path.join(
//             __dirname,
//             `downloads/${imei}/${timestamp}.mp4`
//           );
//           if(fs.existsSync(file1Path)){
//             fs.unlink(file1Path, (err) => {
//               if (err) {
//                   console.error('Error deleting the file:', err);
//               } else {
//                   console.log('File deleted successfully.');
//               }
//           });
//           }
//           videoConversion(imei,timestamp)
//       });
//       } else {
//         const IMEI = device_info.getDeviceDirectory(); // IMEI number
//         const filename = `${timestamp}` + device_info.getExtension(); // filename
//         // let sendedData = {
//         //   clientId: device_info.getclientId(),
//         //   vehicle: device_info.getvehicle(),
//         //   timestamp: device_info.newtimestamp(),
//         //   progress: 100,
//         //   message: "Device is not sending data or camera is off!! Downloaded file is uploaded"
//         // }
//         // Construct the path to the file
//         console.log('-0-0-0-0-' ,IMEI, filename)
//         const filePath = path.join(__dirname, IMEI, filename);
//         let fileContent 

//         try{
//  fileContent 
//         = fs.readFileSync(filePath);}catch(e){
//           console.log(e.message)
//         }
//         console.log("data is ", fileContent);
//         params.Body = fileContent;
//         let deviceInfo = device_info.getDeviceDirectory();
//         let directory = deviceInfo.split("/").pop();
//         let cameraType =  device_info.getFileToDL()
//         /*  uploadToS3(params,{fileType,fileName,deviceIMEI:directory});   
//        device_info.setUploadedToS3(true);  */
//         uploadToS3(params, { fileType, fileName, deviceIMEI: directory, cameraType }).then(
//           (result) => {
//             device_info.setUploadedToS3(true);
//             emitdatatoSocket(device_info.getsavedHalfData())
//             // fs.unlink(filePath, (err) => {
//             //   if (err) {
//             //     console.error("Error deleting file:", err);
//             //   } else {
//             //     console.log("File deleted successfully");
//             //   }
//             // });
//           }
//         );
//       }
//     }
//   }
function onConnClose() {
    
}
  function onConnError(err) {
   // dbg.logAndPrint("Connection " + remoteAddress + " error: " + err.message);
   // console.log("onConnError");
  }
  function onConnTimeout() {
 //   dbg.logAndPrint("Connection from " + remoteAddress + " timeouted");
  //  console.log("onConnTimeout");
  }
}
