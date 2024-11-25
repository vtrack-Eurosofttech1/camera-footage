const net = require("net");
const commandLineArgs = require("command-line-args");
const tls = require("tls");
const fs = require("fs");
// const protocol = require("./protocol.js");
const protocol = require("./protocol4.js");
const cliProgress = require("cli-progress");
const _colors = require("colors");
const dbg = require("./debug.js");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { exec } = require("child_process");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");
const emitdatatoSocket = require("./socket.js");
const { checkVideoPlayback, videoConversion } = require("./nn.js");
const { processVideoFile, processImageFile } = require("./setparamsofS3.js");
process.setMaxListeners(50);

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
//const buffer_size = 200000;
//const buffer_size = 1030 * 1000
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
//   const inactivityTimer = setInterval(() => {
//     if (Date.now() - lastActivityTime > INACTIVITY_TIMEOUT) {
      
//       connection.destroy(); // Close the connection
//       clearInterval(inactivityTimer); // Clear the interval timer
//     }
//   }, 1000); // Check every second
//   connection.setNoDelay(true); // Disable Nagle's algorithm for faster transmission
// connection.setTimeout(0); // Disable timeout
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
//   function lookForSyncPacket(data) {
//     let indexOfSync = data.toString("hex").indexOf("00030004");
//     if (indexOfSync > 0) {
//       data = data.slice(indexOfSync / 2, data.length);
//     }
//     return data;
//   }
let packetData = {
  packetCount: 0,
  packets: []
};

function formatBufferToHex(buffer) {

  const hexString = buffer.toString('hex');
  return hexString.match(/.{1,2}/g).join(',');
}


  function onConnData(data) {
   // console.log("time", data.length,Date.now())
    // let indexOfSync = data.toString("hex").indexOf("00030004");
    // if(data.toString("hex").indexOf("000B")){
    //   console.log("data,", data)
    // }
   // console.log("metadata_option",metadata_option)
   // lastActivityTime = Date.now();
 //  console.log("ada", data.slice(0,100))
    if(device_info.getfirstdata() == true){ 
      const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data);

      const dataLength = bufferData.length;
      packetData.packetCount++;
  const currentTime = Date.now();
  const formattedHex = formatBufferToHex(bufferData);
  packetData.packets.push({
    length: dataLength,
    data: formattedHex,
    time: currentTime 
  });
  
  try {
   // console.time("save")
    // fs.writeFile(path.join(__dirname, 'packetData2new.json'), JSON.stringify(packetData, null, 2), (err) => {
        // if (err) {
          // console.error("Error writing to file:", err);
        // } else {
      //   console.log("Packet data written to file successfully.");
        // }
      // });
      fs.writeFileSync(path.join(__dirname, 'packetData2new.json'), JSON.stringify(packetData, null, 2), 'utf-8');
   // console.timeEnd("save")


      device_info.incrementReceivedPackageCnt(1);
      let rx_pkg_cnt = device_info.getReceivedPackageCnt();
      progress_bar.update(rx_pkg_cnt);
    
    //  emitdatatoSocket(device_info.getDeviceInfoData());
      

    if (
      device_info.getTotalPackages() == device_info.getReceivedPackageCnt()
    ) {
      device_info.first_sync_received = false;
      device_info.sync_received == false;
      device_info.setfirstdata(false)
      current_state = protocol.fsm_state.FINISH_RECEIVING;
    }

} catch (error) {
    console.log("Error writing to file:", error);
  }
    
}

    // if (current_state == protocol.fsm_state.REPEAT_PACKET) {
       

    // //  data = lookForSyncPacket(data);
    //   cmd_id = protocol.ParseCmd(data);
    //   if (cmd_id != protocol.cmd_id.SYNC) {

    //     let repeat_interval = device_info.repeat_count > 9 ? 4000 : 2000;
    //     if (Date.now() - device_info.repeat_sent_ts > repeat_interval) {
          
    //       repeatSyncRequest();
    //     }
    //     return;
    //   } else {
    //     tcp_buffer = Buffer.alloc(0);
    //   }
    // }
    else {

    
    tcp_buffer = Buffer.concat([tcp_buffer, data]);
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

    //   if (tcp_buffer.length < cmd_size) {
      
    //     return;
    //   }
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
      //  repeat_cycle = true;
      }
    }
  }


 function onConnClose() {
  console.log("close")
    
 }
  function onConnError(err) {

   // dbg.logAndPrint("Connection " + remoteAddress + " error: " + err.message);
    console.log("onConnError");
  }
  function onConnTimeout() {
 //   dbg.logAndPrint("Connection from " + remoteAddress + " timeouted");
    console.log("onConnTimeout");
  }
}
