
const fs = require("fs");
const { exec } = require("child_process");
const dbg = require("./debug.js");
const { uploadToS3 } = require("./uploadToS3.js");
const path = require("path");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");
const DeviceModel = require("./model/device.model");
const emitdatatoSocket = require("./socket.js");
const { processVideoFile, processImageFile } = require("./setparamsofS3.js");
const { camera_type } = require("./protocol.js");

const FSM_STATE = {
  WAIT_FOR_CMD: 0,
  INIT: 1,
  RECEIVE_DATA: 2,
  FINISH_RECEIVING: 3,
  REPEAT_PACKET: 4,
  SEND_METADATA_REQUEST: 5,
  SEND_FILEPATH: 6,
  LOOK_FOR_FILES: 7,
  SEND_COMPLETE: 8,
  SEND_END: 9,
  END: 10
};
exports.fsm_state = FSM_STATE;
const DUALCAM_FILE_PATH = {
  DUALCAM_PHOTO_FRONT: "%photof",
  DUALCAM_PHOTO_REAR: "%photor",
  DUALCAM_VIDEO_FRONT: "%videof",
  DUALCAM_VIDEO_REAR: "%videor"
};
const CAMERA_TYPE = {
  AUTO: 0,
  ADAS: 1,
  DUALCAM: 2,
  DSM: 3,
  LAST: 4
};
exports.camera_type = CAMERA_TYPE;

const METADATA_TYPE = {
  NO_METADATA: 0,
  AT_START: 1
};
exports.metadata_type = METADATA_TYPE;
const CMD_ID = {
  NONE: -1,
  INIT: 0,
  START: 1,
  SYNC: 3,
  DATA: 4,
  COMPLETE: 5,
  METADATA: 11,
  FILEPATH: 13,
  ENHANCED_DATA: 14
};
exports.cmd_id = CMD_ID;
/* const COMPLETE_STATUS = {
  SUCCESS: 0,
  LIMIT_REACHED: 1,
  FAILED_TO_CLOSE_SESSION: 2,
  FAILED_TO_CLOSE_SOCKET: 3,
  DEVICE_ABORTED: 4,
  INV_INIT_RESPONSE: 5,
  INV_RESUME_RESPONSE: 6,
  FAIL_SD_CREATE: 7,
  FAIL_SD_OPEN: 8,
  FAIL_SD_WRITE: 9,
  FAIL_SD_FLUSH: 10,
  UNDEFINED_EVENT: 11,
  FAIL_FOTA_CREATE: 12,
  FAIL_CRC_CALC: 13,
  FAIL_LOAD_CONFIG: 14,
  FAIL_FILE_VALIDATE: 15,
  FAIL_FILE_ROLL_POINTER: 16,
  FAIL_FILE_READ: 17,
  FAIL_FILE_HEADER_NULL: 18,
  PLATFORM_ID_MISSMATCH: 19,
  UPDATE_NOT_ALLOWED: 20,
  INVALID_QUERY_ARG: 21,
  FAIL_XIM_REQ_JOB: 22,
  FORBIDDEN_BY_SPEC: 23,
  UNSUPPORTED_HW: 24,
  INCOMPATIBLE_FW: 25,
  WRONG_BL_VERSION: 26
};
const COMPLETE_STATUS_DESCRIPTION = {
  0: " - File successfully received",
  1: " - Reconnect limit reached. Device tried to reconnect to server 5 times and failed.",
  2: " - Failed to close GPRS. I.e. current GPRS session which is open is not the same as GPRS settings sent with file download request command.",
  3: " - Failed to close socket.",
  4: " - Device aborted file download.",
  5: " - Invalid server response to init packet.",
  6: " - Invalid server response to resume packet.",
  7: " - Failed to create file @ SD card for storing data.",
  8: " - Failed to open file @ SD card.",
  9: " - Failed to write to file @ SD card.",
  10: " - Failed file flush @ SD card.",
  11: " - File download procedure received undefined EVENT.",
  12: " - Failed to create FOTA  update file.",
  13: " - Failed file CRC recalculation at the end of file download.",
  14: " - Failed to load downloaded configuration file.",
  15: " - Failed to validate file. Bad file header detected.",
  16: " - Failed to roll file pointer.",
  17: " - Failed to read file.",
  18: " - Failed to validate file header, header pointer is null.",
  19: " - Current and target platform ID mismatch.",
  20: " - Update to target FW version is not allowed.",
  21: " - Invalid query validation arguments.",
  22: " - Requested Jobs by XIM failed",
  23: " - Forbidden by SPEC ID FW (not allowed or minimum FW version for spec)",
  24: " - Not supported by HW revision (FW do not support this HW)",
  25: " - Incompatible FW (changed image layout)",
  26: " - Wrong BL version (in general - HW and BL mismatch)"
}; */
function Device() {
  this.fsm_state = FSM_STATE.WAIT_FOR_CMD;
  this.deviceDirectory = "";
  this.filename = "";
  this.actual_crc = 0;
  this.received_packages = 0;
  this.total_packages = 0;
  this.extension_to_use = "";
  this.query_file = 0;
  this.file_buff = Buffer.alloc(0);
  this.camera = CAMERA_TYPE.AUTO;
  this.clientId = "";
  this.metadata_type = METADATA_TYPE.NO_METADATA;
  this.sync_offset_correction = 0;
  this.first_sync_received = false;
  this.sync_received = false;
  this.repeat_sent_ts = 0;
  this.repeat_count = 0;
  this.protocol_version = 0;
  this.uploaded_to_s3 = false;
}
exports.DeviceDescriptor = Device;
Device.prototype.setDeviceDirectory = function (directory) {
  this.deviceDirectory = directory;
};
Device.prototype.getDeviceDirectory = function () {
  return this.deviceDirectory;
};
Device.prototype.setclientId = function (directory) {
  this.clientId = directory;
};
Device.prototype.getclientId = function () {
  return this.clientId;
}; 
Device.prototype.setvehicle = function (directory) {
  this.vehicle = directory;
};
Device.prototype.getvehicle = function () {
  return this.vehicle;
};
Device.prototype.setCurrentFilename = function (filename) {
  this.filename = filename;
};
Device.prototype.getCurrentFilename = function () {
  return this.filename;
};
Device.prototype.setLastCRC = function (crc) {
  this.actual_crc = crc;
};
Device.prototype.getLastCRC = function () {
  return this.actual_crc;
};
Device.prototype.incrementReceivedPackageCnt = function (bytes_received) {
  this.received_packages += bytes_received;
};
Device.prototype.getReceivedPackageCnt = function () {
  return this.received_packages;
};
Device.prototype.setReceivedPackageCnt = function (package_cnt) {
  this.received_packages = package_cnt;
};
Device.prototype.resetReceivedPackageCnt = function () {
  this.received_packages = 0;
};
Device.prototype.setTotalPackages = function (pkg) {
  this.total_packages = pkg;
};
Device.prototype.getTotalPackages = function () {
  return this.total_packages;
};
Device.prototype.getExtension = function () {
  return this.extension_to_use;
};
Device.prototype.setExtension = function (extension) {
  this.extension_to_use = extension;
};
Device.prototype.setFileToDL = function (file) {
  this.query_file = file;
};
Device.prototype.getFileToDL = function (file) {
  return this.query_file;
};
Device.prototype.getFileBuffer = function () {
  return this.file_buff;
};
Device.prototype.addToBuffer = function (data, offset) {
  this.file_buff = this.file_buff.slice(0, offset);
  this.file_buff = Buffer.concat([this.file_buff, data]);
};
Device.prototype.clearBuffer = function () {
  this.file_buff = Buffer.alloc(0);
};
Device.prototype.setCameraType = function (type) {
  this.camera = type;
};
Device.prototype.getCameraType = function () {
  return this.camera;
};
Device.prototype.setProtocolVersion = function (protocol_version) {
  this.protocol_version = protocol_version;
};
Device.prototype.setnewtimestamp = function (data) {
  this.newtimestamp = data
};
Device.prototype.newtimestamp = function () {
  return this.newtimestamp;
};
Device.prototype.getProtocolVersion = function () {
  return this.protocol_version;
};

Device.prototype.setUploadedToS3 = function (value) {
  this.uploaded_to_s3 = value;
};

Device.prototype.getUploadedToS3 = function () {
  return this.uploaded_to_s3;
};
Device.prototype.getsavedHalfData = function () {
 return {
  clientId: this.clientId ,  //device_info.getclientId(),
      vehicle: this.vehicle, //device_info.getvehicle(),
      timestamp: this.newtimestamp , //device_info.newtimestamp(),
      progress: 100,
      message: "Due to low GSM signal Downloading stop! Downloaded Media is uploaded"
   

}

};


Device.prototype.getDeviceInfoData = function () {
  let extension ;
  if(this.extension_to_use==".h265"){
    extension = ".mp4"

  }else{
    extension=this.extension_to_use
  }
  return {
    progress :(this.received_packages/this.total_packages)*100,
    filetype: this.extension_to_use,
    // fsm_state: this.fsm_state,,
    camera_type: this.query_file,
    timestamp:this.newtimestamp ,
    deviceDirectory: this.deviceDirectory,
    filename: this.filename,
    path:`https://vtracksolutions.s3.eu-west-2.amazonaws.com/media/${this.deviceDirectory.split("/")[1]}/${this.newtimestamp}${extension}`,    
    // actual_crc: this.actual_crc,
    received_packages: this.received_packages,
    total_packages: this.total_packages,
    vehicle:this.vehicle,
   // extension_to_use: this.extension_to_use,
    // query_file: this.query_file,
    // file_buff: this.file_buff,
    camera: this.camera,
    clientId: this.clientId,
    metadata_type: this.metadata_type,
    // sync_offset_correction: this.sync_offset_correction,
    // first_sync_received: this.first_sync_received,
    // sync_received: this.sync_received,
    // repeat_sent_ts: this.repeat_sent_ts,
    // repeat_count: this.repeat_count,
    // protocol_version: this.protocol_version,
    // uploaded_to_s3: this.uploaded_to_s3
  };
};

let DUALCAM_ADAS_TRIGGER_SOURCE = {
  0: "SERVER REQUEST",
  1: "DIN1",
  2: "DIN2",
  3: "CRASH",
  4: "TOWING",
  5: "IDLING",
  6: "GEOFENCE",
  7: "UNPLUG",
  8: "GREEN DRIVING",
  9: "PERIODIC",
  10: "DIN3",
  11: "DIN4"
};

// let ADAS_TRIGGER_SOURCE = {
//   0: "SERVER REQUEST",
//   1: "DIN1",
//   2: "DIN2",
//   3: "DIN3",
//   4: "DIN4",
//   5: "CRASH",
//   6: "TOWING",
//   7: "IDLING",
//   8: "GEOFENCE",
//   9: "UNPLUG",
//   10: "GREEN DRIVING"
// };
// let DSM_TRIGGER_SOURCE = {
//   0: "NONE",
//   1: "DIN1",
//   2: "DIN2",
//   3: "DIN3",
//   4: "DIN4",
//   5: "CRASH",
//   6: "TOWING",
//   7: "IDLING",
//   8: "GEOFENCE",
//   9: "UNPLUG",
//   10: "GREEN DRIVING",
//   11: "SERVER",
//   12: "PERIODIC",
//   13: "DSM EVENT",
//   14: "FILE RETRANSMIT"
// };
let DUALCAM_FILE_TYPE = {
  4: "FRONT PHOTO",
  8: "REAR PHOTO",
  16: "FRONT VIDEO",
  32: "REAR VIDEO"
};
// let ADAS_FILE_TYPE = {
//   0: "VIDEO",
//   1: "SNAPSHOT",
//   2: "CURRENT SNAPSHOT",
//   3: "RETRANSMITTED SNAPSHOT"
// };
function MetaData() {
  this.command_version = ""; //1 byte
  this.file_type = ""; //1 byte
  this.timestamp = ""; //8 bytes (uint, seconds)
  this.upload_time = 0;
  this.capture_time = 0;
  this.trigger_source = ""; //1 byte
  this.length = ""; //2 bytes
  this.framerate = ""; //1 byte
  this.timezone = ""; //2 bytes (int, minutes)
  this.latitude = ""; //8 bytes
  this.longitude = ""; //8 bytes
  this.events = ""; //2 bytes
  this.driver_name = ""; //10 bytes
}
exports.MetaDataDescriptor = MetaData;
MetaData.prototype.reset = function () {
  this.command_version = "";
  this.file_type = "";
  this.timestamp = "";
  this.upload_time = 0;
  this.capture_time = 0;
  this.trigger_source = "";
  this.length = "";
  this.framerate = "";
  this.timezone = "";
  this.latitude = "";
  this.longitude = "";
  this.dsm_events = "";
  this.driver_name = "";
  this.json_string = "";
};
MetaData.prototype.getString = function (camera) {
  let string = "";
  if (camera == CAMERA_TYPE.DUALCAM) {
    string = "Cmd version: \t" + this.command_version + "\n";
    string += "File type: \t" + this.file_type + "\n";
    string += "Time (UTC+0): \t" + this.timestamp + "\n";
    string += "Trigger: \t" + this.trigger_source + "\n";
    string += "Length (s): \t" + this.length + "\n";
    string += "Framerate: \t" + this.framerate + "\n";
    string += "Timezone (m): \t" + this.timezone + "\n";
    string += "Latitude: \t" + this.latitude + "\n";
    string += "Longitude: \t" + this.longitude + "\n";
  }
  if (camera == CAMERA_TYPE.ADAS) {
    string = "Time (UTC+0): \t" + this.timestamp + "\n";
    string += "File type: \t" + this.file_type + "\n";
    string += "Trigger: \t" + this.trigger_source + "\n";
    string += "Length (s): \t" + this.length + "\n";
    string += "Latitude: \t" + this.latitude + "\n";
    string += "Longitude: \t" + this.longitude + "\n";
  }
  if (camera == CAMERA_TYPE.DSM) {
    string = "Time (UTC+0): \t" + this.timestamp + "\n";
    string += "File type: \t" + this.file_type + "\n";
    string += "Trigger: \t" + this.trigger_source + "\n";
    string += "Latitude: \t" + this.latitude + "\n";
    string += "Longitude: \t" + this.longitude + "\n";
    string += "Events: \t" + this.dsm_events + "\n";
    string += "Driver: \t" + this.driver_name + "\n";
  }
  return string;
};
MetaData.prototype.parseData = function (metadata, device_info, raw_data) {
  metadata.reset();
  if (device_info.getCameraType() == CAMERA_TYPE.DUALCAM) {
    metadata.setCommandVersion(raw_data.slice(0, 1)); //1 byte
    metadata.setFileType(raw_data.slice(1, 2), device_info.getCameraType()); //1 byte
    metadata.setTimestamp(raw_data.slice(2, 10), device_info.getCameraType()); //8 bytes (uint, seconds)
    metadata.setTriggerSource(
      raw_data.slice(10, 11),
      device_info.getCameraType()
    ); //1 byte
    metadata.setLength(raw_data.slice(11, 13), device_info.getCameraType()); //2 bytes
    metadata.setFramerate(raw_data.slice(13, 14)); //1 byte
    metadata.setTimezone(raw_data.slice(14, 16)); //2 bytes (int, minutes)
    metadata.setLatitude(raw_data.slice(16, 24), device_info.getCameraType()); //8 bytes
    metadata.setLongitude(raw_data.slice(24, 32), device_info.getCameraType()); //8 bytes
  }
  if (device_info.getCameraType() == CAMERA_TYPE.ADAS) {
    metadata.setTimestamp(raw_data.slice(0, 4), device_info.getCameraType()); //4 bytes (uint, seconds)
    metadata.setFileType(raw_data.slice(4, 5), device_info.getCameraType()); //1 byte
    metadata.setTriggerSource(
      raw_data.slice(5, 6),
      device_info.getCameraType()
    ); //1 byte
    metadata.setLatitude(raw_data.slice(6, 10), device_info.getCameraType()); //4 bytes
    metadata.setLongitude(raw_data.slice(10, 14), device_info.getCameraType()); //4 bytes
    metadata.setLength(raw_data.slice(14, 15), device_info.getCameraType()); //1 byte
  }
  if (device_info.getCameraType() == CAMERA_TYPE.DSM) {
    metadata.setTimestamp(raw_data.slice(0, 4), device_info.getCameraType()); //4 bytes (uint, seconds)
    metadata.setFileType(raw_data.slice(4, 5), device_info.getCameraType()); //1 byte
    metadata.setTriggerSource(
      raw_data.slice(5, 6),
      device_info.getCameraType()
    ); //1 byte
    metadata.setLatitude(raw_data.slice(6, 10), device_info.getCameraType()); //4 bytes
    metadata.setLongitude(raw_data.slice(10, 14), device_info.getCameraType()); //4 bytes
    metadata.setDSMEvents(raw_data.slice(14, 16), device_info.getCameraType()); //2 bytes
    metadata.setDriverName(raw_data.slice(16, 26), device_info.getCameraType()); //10 bytes
  }
};
MetaData.prototype.parseJsonValue = function (
  jsonData,
  key_to_search,
  targetObject
) {
  let result;

  const searchKeyInObject = (obj) => {
    for (const key in obj) {
      if (key === key_to_search && !targetObject) {
        result = obj[key];
        return;
      }
      if (key === targetObject) {
        const target = obj[key];
        if (target && typeof target[key_to_search] !== "undefined") {
          result = target[key_to_search];
          return;
        }
      }
      if (typeof obj[key] === "object" && obj[key] !== null) {
        searchKeyInObject(obj[key]);
      }
    }
  };

  searchKeyInObject(jsonData);

  return result == null ? 0 : result;
};
MetaData.prototype.parseJsonData = function (metadata, device_info, jsonData) {
  metadata.reset();

  this.json_string = JSON.stringify(jsonData, null, 2);
  this.command_version = this.parseJsonValue(jsonData, "version", "");
  this.file_type = this.parseJsonValue(jsonData, "file_type", "file");
  var date = new Date(
    Number(this.parseJsonValue(jsonData, "file_timestamp", "file")) * 1000
  );
  this.timestamp =
    date.toISOString().replace(/[TZ]/g, " ") +
    "(" +
    this.parseJsonValue(jsonData, "file_timestamp", "file") +
    ")";
  this.trigger_source = this.parseJsonValue(jsonData, "type", "fm_trigger");
  this.latitude = this.parseJsonValue(jsonData, "latitude", "location");
  this.longitude = this.parseJsonValue(jsonData, "longitude", "location");
  this.length = this.parseJsonValue(jsonData, "duration", "file");
  this.framerate = this.parseJsonValue(jsonData, "framerate", "file");
  this.timezone = 0;
  this.dsm_events = this.setDSMEvents(
    this.parseJsonValue(jsonData, "type", "cam_trigger"),
    device_info.getCameraType()
  );
  this.driver_name = this.parseJsonValue(jsonData, "driver_name", "");
};
MetaData.prototype.setCommandVersion = function (command_version) {
  this.command_version = command_version.readUInt8(0).toString(10);
};
MetaData.prototype.getCommandVersion = function () {
  return this.command_version;
};
MetaData.prototype.setFileType = function (file_type, camera) {
  if (camera == CAMERA_TYPE.DUALCAM) {
    this.file_type =
      DUALCAM_FILE_TYPE[file_type.readUInt8(0)] +
      " (" +
      file_type.readUInt8(0).toString(10) +
      ")";
  }
  if (camera == CAMERA_TYPE.ADAS) {
    this.file_type =
      ADAS_FILE_TYPE[file_type.readUInt8(0)] +
      " (" +
      file_type.readUInt8(0).toString(10) +
      ")";
  }
  if (camera == CAMERA_TYPE.DSM) {
    this.file_type =
      ADAS_FILE_TYPE[file_type.readUInt8(0)] +
      " (" +
      file_type.readUInt8(0).toString(10) +
      ")";
  }
};
MetaData.prototype.getFileType = function () {
  return this.file_type;
};
MetaData.prototype.setTimestamp = function (timestamp, camera) {
  if (camera == CAMERA_TYPE.DUALCAM) {
    var date = new Date(Number(timestamp.readBigUInt64BE(0)));
    this.timestamp =
      date.toISOString().replace(/[TZ]/g, " ") +
      "(" +
      timestamp.readBigUInt64BE(0).toString(10) +
      ")";
  }
  if (camera == CAMERA_TYPE.ADAS) {
    var date = new Date(Number(timestamp.readUInt32BE(0)) * 1000);

    this.timestamp =
      date.toISOString().replace(/[TZ]/g, " ") +
      "(" +
      timestamp.readUInt32BE(0).toString(10) +
      ")";
  }
  if (camera == CAMERA_TYPE.DSM) {
    var date = new Date(Number(timestamp.readUInt32BE(0)) * 1000);
    this.timestamp =
      date.toISOString().replace(/[TZ]/g, " ") +
      "(" +
      timestamp.readUInt32BE(0).toString(10) +
      ")";
  }
};
MetaData.prototype.getTimestamp = function () {
  return this.timestamp;
};
MetaData.prototype.setTriggerSource = function (trigger_source, camera) {
  if (camera == CAMERA_TYPE.DUALCAM) {
    this.trigger_source =
      DUALCAM_ADAS_TRIGGER_SOURCE[trigger_source.readUInt8(0)] +
      " (" +
      trigger_source.readUInt8(0).toString(10) +
      ")";
  }
  //   if (camera == CAMERA_TYPE.ADAS) {
  //     this.trigger_source =
  //       ADAS_TRIGGER_SOURCE[trigger_source.readUInt8(0)] +
  //       " (" +
  //       trigger_source.readUInt8(0).toString(10) +
  //       ")";
  //   }
  //   if (camera == CAMERA_TYPE.DSM) {
  //     this.trigger_source =
  //       DSM_TRIGGER_SOURCE[trigger_source.readUInt8(0)] +
  //       " (" +
  //       trigger_source.readUInt8(0).toString(10) +
  //       ")";
  //   }
};
MetaData.prototype.getTriggerSource = function () {
  return this.trigger_source;
};
MetaData.prototype.setLength = function (length, camera) {
  if (camera == CAMERA_TYPE.DUALCAM) {
    this.length = length.readUInt16BE(0).toString(10);
  }
};
MetaData.prototype.getLength = function () {
  return this.length;
};
MetaData.prototype.setFramerate = function (framerate) {
  this.framerate = framerate.readUInt8(0).toString(10);
};
MetaData.prototype.getFramerate = function () {
  return this.framerate;
};
MetaData.prototype.setTimezone = function (timezone) {
  this.timezone = timezone.readInt16BE(0).toString(10);
};
MetaData.prototype.getTimezone = function () {
  return this.timezone;
};


MetaData.prototype.setLatitude = function (latitude, camera) {
  if (camera == CAMERA_TYPE.DUALCAM) {
    this.latitude = latitude.readDoubleBE(0).toString(10);
  }
};
MetaData.prototype.getLatitude = function () {
  return this.latitude;
};
MetaData.prototype.setLongitude = function (longitude, camera) {
  if (camera == CAMERA_TYPE.DUALCAM) {
    this.longitude = longitude.readDoubleBE(0).toString(10);
  }
};
MetaData.prototype.getLongitude = function () {
  return this.longitude;
};
MetaData.prototype.setDSMEvents = function (dsm_events, camera) {
  if (camera == CAMERA_TYPE.DSM) {
    let dsm_number = (dsm_events[0] << 8) | dsm_events[1];
    let events_string = "";
    events_string += (dsm_number & (1 << 0)) > 0 ? "DROWSINESS " : "";
    events_string += (dsm_number & (1 << 1)) > 0 ? "DISTRACTION " : "";
    events_string += (dsm_number & (1 << 2)) > 0 ? "YAWNING " : "";
    events_string += (dsm_number & (1 << 3)) > 0 ? "PHONE " : "";
    events_string += (dsm_number & (1 << 4)) > 0 ? "SMOKING " : "";
    events_string += (dsm_number & (1 << 5)) > 0 ? "DRIVER ABSENCE " : "";
    events_string += (dsm_number & (1 << 6)) > 0 ? "MASK " : "";
    events_string += (dsm_number & (1 << 7)) > 0 ? "SEAT BELT " : "";
    events_string += (dsm_number & (1 << 8)) > 0 ? "G-SENSOR " : "";
    this.dsm_events =
      events_string + "(" + (dsm_number >>> 0).toString(2) + ")";
  }
};
MetaData.prototype.getDSMEvents = function () {
  return this.dsm_events;
};
const toString = (bytes) => {
  var result = "";
  for (var i = 0; i < bytes.length; ++i) {
    if (bytes[i] > 127) return "          "; // 10 spaces
    const byte = bytes[i];
    const text = byte.toString(16);
    result += (byte < 16 ? "%0" : "%") + text;
  }
  return decodeURIComponent(result);
};
function reverseString(str) {
  var newString = "";
  for (var i = str.length - 1; i >= 0; i--) {
    newString += str[i];
  }
  return newString;
}
MetaData.prototype.setDriverName = function (driver_name, camera) {
  if (camera == CAMERA_TYPE.DSM) {
    this.driver_name = reverseString(toString(driver_name));
  }
};
MetaData.prototype.getDriverName = function () {
  return this.driver_name;
};
function crc16_generic(init_value, poly, data) {
  let RetVal = init_value;
  let offset;
  for (offset = 0; offset < data.length; offset++) {
    let bit;
    RetVal ^= data[offset];
    for (bit = 0; bit < 8; bit++) {
      let carry = RetVal & 0x01;
      RetVal >>= 0x01;
      if (carry) {
        RetVal ^= poly;
      }
    }
  }
  return RetVal;
}
exports.ParseCmd = function (a) {
  return a.readUInt16BE(0);
};
exports.CmdHasLengthField = function getCmdLengthOpt(cmd_id) {
  if (
    cmd_id == 4 ||
    cmd_id == 5 ||
    cmd_id == 13 ||
    cmd_id == 11 ||
    cmd_id == 14
  ) {
    return true;
  }
  return false;
};
exports.IsCmdValid = function doesCmdExist(cmd_id) {
  if (cmd_id < 15) {
    return true;
  } else {
    return false;
  }
};
exports.GetExpectedCommandLength = function (cmd) {
  let return_value = 0;
  switch (cmd) {
    case 0:
      return_value = 16;
      break;
    case 1:
      return_value = 10;
      break;
    case 3:
      return_value = 8;
      break;
    case 5:
      return_value = 8;
      break;
  }
  return return_value;
};
function ParseFilePath(a) {
  let path = a.toString().substring(4);
  return path;
}
function SaveToFileJSON(jsonString, path) {
  fs.appendFile(path, jsonString, (err) => {
    if (err) {
      dbg.error("Error writing JSON to file", err);
    } else {
      dbg.logAndPrint("JSON data written to file successfully");
    }
  });
}

// Function to read the JSON file
const readJSONFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
}
return null;
  
        
};

// Function to write the JSON file
const writeJSONFile = (filePath, data) => {
  //console.log("ss",filePath, data)
     fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Function to update the JSON file with new values
const updateJSONFile = (newValues, filePath) => {
  const jsonData = readJSONFile(filePath) || {}; // Read existing data or use an empty object
  let newObj = {
    IMEI: newValues.imei || jsonData.imei,
    timestamp: newValues.timestamp || jsonData.timestamp,
    totalPackages: (jsonData.totalPackages || 0) + (newValues.totalPackages || 0),
    receivedPackages: (jsonData.receivedPackages || 0) + (newValues.receivedPackages || 0),
    lastCrc: newValues.lastCrc || jsonData.lastCrc,
    uploadedToS3: newValues.uploadedToS3 || jsonData.uploadedToS3,
    ReceivedAllPackets: newValues.ReceivedAllPackets || jsonData.ReceivedAllPackets        ,
    lastReceivedPackages: (jsonData.lastReceivedPackages || 0) + (newValues.lastReceivedPackages || 0),
    camera_type: newValues.camera_type || jsonData.camera_type,
    clientId: newValues.clientId || jsonData.clientId,
    vehicle: newValues.vehicle || jsonData.vehicle,
    framerate: newValues.framerate || jsonData.framerate,
  }
  Object.assign(jsonData,newObj)
  // Update attributes with new values
  // jsonData.IMEI = newValues.imei || jsonData.imei;
  // jsonData.timestamp = newValues.timestamp || jsonData.timestamp;
  // jsonData.totalPackages = (jsonData.totalPackages || 0) + (newValues.totalPackages || 0);
  // jsonData.receivedPackages = (jsonData.receivedPackages || 0) + (newValues.receivedPackages || 0);
  // jsonData.lastCrc = newValues.lastCrc || jsonData.lastCrc;
  // jsonData.uploadedToS3 = newValues.uploadedToS3 || jsonData.uploadedToS3;
  // jsonData.ReceivedAllPackets = newValues.ReceivedAllPackets || jsonData.ReceivedAllPackets;         
  // jsonData.lastReceivedPackages = (jsonData.lastReceivedPackages || 0) + (newValues.lastReceivedPackages || 0);
  // jsonData.camera_type = newValues.camera_type || jsonData.camera_type;
  // jsonData.clientId = newValues.clientId || jsonData.clientId;
  // jsonData.vehicle = newValues.vehicle || jsonData.vehicle;
  // jsonData.framerate = newValues.framerate || jsonData.framerate
  // Append new values to the buffer
  if (newValues.buffer) {
      jsonData.buffer = jsonData.buffer || []; // Initialize buffer if it doesn't exist
      jsonData.buffer.push(...newValues.buffer); // Spread new values into the existing buffer
  }
  if (newValues.packets && Array.isArray(newValues.packets)) {
      jsonData.packets = jsonData.packets || []; // Initialize packets if it doesn't exist
      jsonData.packets.push(...newValues.packets); // Spread new packet objects into the existing packets array
  }
  // Write the updated data back to the file
   writeJSONFile(filePath, jsonData);
};



exports.run_fsm = async function (
  current_state,
  connection,
  cmd_id,
  data_buffer,
  device_info,
  metadata,
  progress_bar,
  camera_option,
  metadata_option
) {
  let file_available = false;

 const startIndex = metadata.timestamp.indexOf('(') + 1;
const endIndex = metadata.timestamp.indexOf(')');
const timestamp = parseInt(metadata.timestamp.substring(startIndex, endIndex), 10);
var pkgscount  ;
device_info.setnewtimestamp(timestamp)
console.log("timestamp",timestamp)
  var frameratevideo = metadata.framerate
  // if(timestamp > Date.now()){
  //   console.log("gbfgb000")
  //   const query = Buffer.from([0, 0, 0, 0]);
  //   ///  dbg.log("[TX]: [" + query.toString("hex") + "]");
  //     connection.write(query);
  // }

  switch (cmd_id) {
    case CMD_ID.START: { 

      switch (device_info.getCameraType()) {
        case CAMERA_TYPE.DUALCAM: {
          pkgscount = 0
          device_info.setTotalPackages(data_buffer.readUInt32BE(4));
         break;
        }
        
      }
        try {
          const filePath2 = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
  if(fs.existsSync(filePath2)){
  let packagescnt ;

    let ttlpkg;

    // fs.readFile(filePath2, 'utf8', (err, data) => { //remove hoga ye
      /* if (err) {
        console.error('Error reading the file:', err);
        return;
      } */
       let jsondata = readJSONFile(filePath2)

      packagescnt = jsondata.receivedPackages
      pkgscount =  jsondata.receivedPackages  
     
      ttlpkg =  jsondata.totalPackages
    device_info.setLastCRC(jsondata.lastcrc);
    device_info.setReceivedPackageCnt(0); //may be 0
    device_info.setTotalPackages((ttlpkg - packagescnt) )
    device_info.clearBuffer();
    
    let offset = pkgscount;
    let query = Buffer.from([0, 2, 0, 4, 0, 0, 0, 0]);
  
     // offset = offset;
    let offsetNum = parseInt(offset, 10)
    offsetNum +=1
    offset = offsetNum.toString()

    query.writeUInt32BE(offset, 4);
          current_state = FSM_STATE.WAIT_FOR_CMD;
          let total_pkg = device_info.getTotalPackages()
          let recive_pkg = device_info.getReceivedPackageCnt();
          progress_bar.start(total_pkg, 0)
          progress_bar.update(recive_pkg);
          emitdatatoSocket(device_info.getDeviceInfoData());
          device_info.file_buff = jsondata.buffer; 
    //   try {
    //     // const filePath1 = path.join(
    //     //   __dirname,
    //     //   device_info.getDeviceDirectory(),
    //     //   `${timestamp}` +
    //     //  '.bin'
    //     // );
    //     // Read existing file data
    //    // const existingData = fs.readFileSync(filePath1);
    //     device_info.file_buff = jsondata.buffer; 
    //   } catch (err) {
    //     console.error('Error reading file length:', err);
    //   }
     
         
    
   // });
    
   
   
  }
  else if (device_info.getTotalPackages() == 0) {
  
      finish_comms = true;
    }
  else {

          const query = Buffer.from([0, 2, 0, 4, 0, 0, 0, 0]);
          connection.write(query);
          let framerate = metadata.framerate
          current_state = FSM_STATE.WAIT_FOR_CMD;
          let total_pkg = device_info.getTotalPackages();
          progress_bar.start(total_pkg, 0);
          emitdatatoSocket(device_info.getDeviceInfoData());
          let filePath = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
          let newData = {
            IMEI: device_info.getDeviceDirectory().split("/").pop(),
            timestamp: timestamp,
            totalPackages: data_buffer.readUInt32BE(4),
            receivedPackages: 0,
            lastcrc: 0,
            lastreceivedPackages: 0,
            camera_type: device_info.getFileToDL(),
            uploadedToS3: false,
            ReceivedAllPackets: false,
            clientId: device_info.setclientId(),
            vehicle: device_info.setvehicle(),
            framerate: framerate,
            buffer: [] ,
            packets: []
          }
          updateJSONFile(newData, filePath)
    

  }
         } catch (error) {
          console.log("error", error)
         }



      break;
    }
    case CMD_ID.SYNC: { //console.log("sync")
      //console.log("cmd sync");
      device_info.sync_received = true;
      device_info.setLastCRC(0);
           let sync_packet = data_buffer.readUInt32BE(4);
         //  let indexOfSync = data_buffer.toString("hex").indexOf("00030004");
          // console.log("indexOfSync",indexOfSync, data_buffer,sync_packet.toString() )
           let sync_packet_str = sync_packet.toString() 
           if(sync_packet_str.endsWith('1')){
            sync_packet_str  = sync_packet_str.slice(0, -1)
           }
          
           //dbg.logAndPrint("sync_packet " + sync_packet,sync_packet_str);
      if (device_info.first_sync_received == false) {
     //   dbg.logAndPrint("cmd sync if");
        device_info.first_sync_received = true;
        device_info.sync_offset_correction = sync_packet;
      }
     
       device_info.setReceivedPackageCnt(
        sync_packet - device_info.sync_offset_correction
      ); 
      device_info.repeat_count = 0;
    //  dbg.logAndPrint("Sync has been received! (" + sync_packet.toString() + ") " + device_info.getLastCRC() + "as" +device_info.getReceivedPackageCnt());
      current_state = FSM_STATE.WAIT_FOR_CMD;
      break;
    }

    case CMD_ID.DATA: {

        if (device_info.sync_received == false) {
        current_state = FSM_STATE.WAIT_FOR_CMD;
        break;
      }
    
      let data_len = data_buffer.readUInt16BE(2) - 2;
 
      let raw_file = data_buffer.slice(4, 4 + data_len);

      // let computed_crc = crc16_generic(
      //   device_info.getLastCRC(),
      //   0x8408,
      //   raw_file
      // );
    
      let actual_crc = data_buffer.readUInt16BE(4 + data_len);
      // if (computed_crc != actual_crc) {

      //   current_state = FSM_STATE.REPEAT_PACKET;
      // } else {
//         switch (device_info.getCameraType()) {
//           case CAMERA_TYPE.DUALCAM: {
//             let receivedPackageCnt =  Math.floor(device_info.file_buff.length / 1024);
//             const offset = receivedPackageCnt * 1024;
//  device_info.addToBuffer(raw_file, offset);
   
//            device_info.incrementReceivedPackageCnt(1);
//             break;
//           }
        
//         }
        device_info.incrementReceivedPackageCnt(1);
        let rx_pkg_cnt = device_info.getReceivedPackageCnt();
   
        progress_bar.update(rx_pkg_cnt);
        console.log(rx_pkg_cnt,
            "Package: " +
              device_info.getReceivedPackageCnt() +
              " / " +
              (device_info.getTotalPackages() -
                (1 - device_info.sync_offset_correction))
          );
        emitdatatoSocket(device_info.getDeviceInfoData());
        
        device_info.setLastCRC(actual_crc);
//console.log("raw_file", raw_file)

let a = {
    length: raw_file.length,
    data: Array.from(raw_file),
    Timestamp: Date.now()
}
        let filePath = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
          let newData = {
            receivedPackages: 1,
            lastcrc: actual_crc,
            lastreceivedPackages: 1,
            buffer: Array.from(raw_file),
            packets: [a]
           
          }
          updateJSONFile(newData, filePath)
    
      

      // }

      if (
        device_info.getTotalPackages() == device_info.getReceivedPackageCnt()
      ) {
        device_info.first_sync_received = false;
        device_info.sync_received == false;
  
        let filePath = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
        let newData = {
            
            ReceivedAllPackets: true,
          
          }
          updateJSONFile(newData, filePath)
          
      
        current_state = FSM_STATE.FINISH_RECEIVING;
      }

      break;
    }

    case CMD_ID.METADATA: {
     // console.log("cmd METADATA");
      /* Read data length minus CRC */
      let data_len = data_buffer.readUInt16BE(2);
      /* Get raw file data */
      let raw_data = data_buffer.slice(4, 4 + data_len);
      if (device_info.getProtocolVersion() >= 6) {
        
        const metadata_string = raw_data.toString("utf-8");
        try {
          const jsonObject = JSON.parse(metadata_string);
          metadata.parseJsonData(metadata, device_info, jsonObject);
        //  dbg.log("[METADATA]: " + metadata_string);
        } catch (error) {
         // dbg.logAndPrint("Error parsing METADATA: " + error);
        }
      } else {
        metadata.parseData(metadata, device_info, raw_data);
       // dbg.log("[METADATA]: [" + raw_data.toString("hex") + "]");
      }
      // dbg.print(
      //   "Got metadata:\n\n" + metadata.getString(device_info.getCameraType())
      // );
      if (metadata_option == METADATA_TYPE.AT_START) {
        if (device_info.getCameraType() == CAMERA_TYPE.DUALCAM) {
        //  dbg.logAndPrint("cmd METADATA SEND_FILEPATH");
          current_state = FSM_STATE.SEND_FILEPATH;
        }
        if (
          device_info.getCameraType() == CAMERA_TYPE.ADAS ||
          device_info.getCameraType() == CAMERA_TYPE.DSM
        ) {
          current_state = FSM_STATE.SEND_FILEPATH;
        }
      }
      break;
    }
    case CMD_ID.FILEPATH: {
     // console.log("cmd FILEPATH");
      let path = ParseFilePath(data_buffer);
      
      if (path.search("dsm") > -1) {
      //  dbg.logAndPrint("Camera: DSM");
        device_info.setCameraType(CAMERA_TYPE.DSM);
      }

      if (path.search("dualcam_front") > -1) {
    //    dbg.logAndPrint("Camera: DualCam Front");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
      }

      if (path.search("dualcam_rear") > -1) {
       // dbg.logAndPrint("Camera: DualCam Rear");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
      }

      if (path.search("dashcam") > -1) {
     //   dbg.logAndPrint("Camera: DashCam");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
      }

 //     dbg.logAndPrint("Got file path: " + path);

      if (path.search("picture") > -1) {
        device_info.setExtension(".jpg");
      }

      if (path.search(".mp4") > -1) {
        device_info.setExtension(".mp4");
      }

      if (path.search(".h265") > -1) {
        device_info.setExtension(".h265");
      }

      device_info.setFileToDL(path);
      device_info.clearBuffer();
      device_info.setLastCRC(0);
      if (metadata_option == METADATA_TYPE.AT_START) {
        current_state = FSM_STATE.SEND_METADATA_REQUEST;
      }
      if (metadata_option == METADATA_TYPE.NO_METADATA) {
        current_state = FSM_STATE.SEND_FILEPATH;
      }
      break;
    }
    case CMD_ID.ENHANCED_DATA: {
     // console.log("cmd ENHANCED_DATA");
      if (device_info.sync_received == false) {
        current_state = FSM_STATE.WAIT_FOR_CMD;
        break;
      }
      /* Read data length minus CRC and offset */
      let data_len = data_buffer.readUInt16BE(2) - 6;
      /* Read file offset */
      let file_offset = data_buffer.readUInt32BE(4);
      /* Get raw file data */
      let raw_file = data_buffer.slice(8, 8 + data_len);
      /* Calculate CRC + add sum of last packet */
      let computed_crc = crc16_generic(
        device_info.getLastCRC(),
        0x8408,
        raw_file
      );
      /* Read actual CRC in packet */
      let actual_crc = data_buffer.readUInt16BE(8 + data_len);

      /* Calculate CRC and display with actual */
    //  dbg.log("CRC = Computed: " + computed_crc + ", Actual : " + actual_crc);

      if (computed_crc != actual_crc) {
      //  dbg.error("CRC mismatch!");
     // console.log("CRC mismatch!");
        current_state = FSM_STATE.REPEAT_PACKET;
      } else {
        if (device_info.getReceivedPackageCnt() != file_offset) {
       //   dbg.error("Packet count mismatch!");
          current_state = FSM_STATE.REPEAT_PACKET;
          break;
        }
        device_info.addToBuffer(raw_file, file_offset);
        device_info.incrementReceivedPackageCnt(data_len);
       

        let rx_pkg_cnt = device_info.getReceivedPackageCnt();
        progress_bar.update(rx_pkg_cnt);
        emitdatatoSocket(device_info.getDeviceInfoData());

        // Save for calculating next packet's CRC
        device_info.setLastCRC(actual_crc);
      }

      if (
        device_info.getTotalPackages() == device_info.getReceivedPackageCnt()
      ) {
        device_info.first_sync_received = false;
        device_info.sync_received == false;
        current_state = FSM_STATE.FINISH_RECEIVING;
      }
      break;
    }
    case CMD_ID.COMPLETE: {
     // console.log("cmd COMPLETE");
      const status_byte = data_buffer.readUInt32BE(4);
      if (status_byte > 0) {
      
        current_state = FSM_STATE.END;
        break;
      }
    }
  }

  if (current_state == FSM_STATE.INIT) {
   // console.log("FSM_STATE.INIT")
  //  dbg.logAndPrint("FSM_STATE.INIT");
    //Create dir with device IMEI if it doesn't exist
    if (!fs.existsSync("downloads")) {
      fs.mkdirSync("downloads");
    }
    // dbg.log("[RX INIT]: [" + data_buffer.toString('hex') + "]");
    /* let imei = data_buffer.readBigUInt64BE(4).toString();

    DeviceModel.model
      .aggregate([
        { $match: { deviceIMEI: imei } },
        {
          $lookup: {
            from: "deviceassigns",
            let: { device: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$DeviceId", { $toString: "$$device" }] }
                }
              }
            ],
            as: "deviceassigns"
          }
        },
        {
          $unwind: "$deviceassigns"
        },
        {
          $project: {
            deviceassigns: 1
          }
        }
      ])
      .then(async (c) => {
        
        if(c.length>0){
        device_info.setclientId(c[0].deviceassigns.clientId);}
      }); */
      let imei = data_buffer.readBigUInt64BE(4).toString();
      DeviceModel.model
      .aggregate([
        { $match: { deviceIMEI: imei } },
        {
          $lookup: {
            from: "deviceassigns",
            let: { device: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$DeviceId", { $toString: "$$device" }] }
                }
              }
            ],
            as: "deviceassigns"
          }
        },
        {
          $unwind: "$deviceassigns"
        }, 
        {
            $lookup: {
              from: "vehicles",
              let: { vehicle: "$deviceassigns.VehicleId" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{$toString:"$_id"}, { $toString: "$$vehicle" }] }
                  }
                }
              ],
              as: "vehicles"
            }
          },
          {
            $unwind: "$vehicles"
          },
        {
          $project: {
            deviceassigns: 1,
            vehicles: 1
          }
        }
      ])
      .then(async (c) => {
        
        if(c.length>0){
         
        device_info.setclientId(c[0].deviceassigns.clientId)
        device_info.setvehicle(c[0].vehicles.vehicleReg)
    }
      }); 

    device_info.setDeviceDirectory("downloads/" + imei.toString());
    if (!fs.existsSync(device_info.getDeviceDirectory())) {
     // dbg.logAndPrint("Creating directory " + device_info.getDeviceDirectory());
      fs.mkdirSync(device_info.getDeviceDirectory());
    }
    // Read protocol version.
    let protocol_version = data_buffer.readUInt16BE(2);
    device_info.setProtocolVersion(protocol_version);
    // Read option byte to see what files are pending
    const option_byte = data_buffer.readUInt8(12);
   // dbg.logAndPrint("Option byte: " + (option_byte >>> 0).toString(2));
    if (
      camera_option == CAMERA_TYPE.ADAS ||
      camera_option == CAMERA_TYPE.DSM ||
      camera_option == CAMERA_TYPE.AUTO ||
      protocol_version >= 6
    ) {
      if (option_byte & 0x02) {
     //   dbg.logAndPrint("File available! Sending file path request.");
        const query = Buffer.from([0, 12, 0, 2, 0, 0]);
        
       // dbg.log("[TX]: [" + query.toString("hex") + "]");
     //   console.log("[TX]: [" + query.toString("hex") + "]")
        connection.write(query);
       
        current_state = FSM_STATE.WAIT_FOR_CMD;
        file_available = true;
      }
    }
    if (
      (camera_option == CAMERA_TYPE.DUALCAM ||
        camera_option == CAMERA_TYPE.AUTO) &&
      protocol_version < 6 &&
      file_available == false
    ) {
      if (option_byte & 0x20) {
    //    dbg.logAndPrint("Camera: DUALCAM");
    //    dbg.logAndPrint("DualCam rear video available!");
        device_info.setFileToDL(DUALCAM_FILE_PATH.DUALCAM_VIDEO_REAR);
        device_info.setExtension(".h265");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
        file_available = true;
      } else if (option_byte & 0x10) {
     //   dbg.logAndPrint("Camera: DUALCAM");
       //dbg.logAndPrint("DualCam front video available!");
        device_info.setFileToDL(DUALCAM_FILE_PATH.DUALCAM_VIDEO_FRONT);
        device_info.setExtension(".h265");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
        file_available = true;
      } else if (option_byte & 0x08) {
      //  dbg.logAndPrint("Camera: DUALCAM");
     //   dbg.logAndPrint("DualCam rear photo available!");
        device_info.setFileToDL(DUALCAM_FILE_PATH.DUALCAM_PHOTO_REAR);
        device_info.setExtension(".jpeg");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
        file_available = true;
      } else if (option_byte & 0x04) {
    //    dbg.logAndPrint("Camera: DUALCAM");
      //  dbg.logAndPrint("DualCam front photo available!");
        device_info.setFileToDL(DUALCAM_FILE_PATH.DUALCAM_PHOTO_FRONT);
        device_info.setExtension(".jpeg");
        device_info.setCameraType(CAMERA_TYPE.DUALCAM);
        file_available = true;
      }

      if (file_available == true) {
      //  console.log("file_available")
    //   dbg.logAndPrint("Got DualCam file path.");
       device_info.clearBuffer();
               device_info.setLastCRC(0);

      }
      if (metadata_option == METADATA_TYPE.AT_START) {
    //    console.log("AT_START")
      //  dbg.logAndPrint("AT_START!");
        current_state = FSM_STATE.SEND_METADATA_REQUEST;
      }
      if (metadata_option == METADATA_TYPE.NO_METADATA) {
      //  console.log("NO_METADATA")
      //  dbg.logAndPrint("NO_METADATA!");
        current_state = FSM_STATE.SEND_FILEPATH;
      }
    }

    if (file_available == false) {
      device_info.setFileToDL(0);
      //console.log("if false")
    // dbg.logAndPrint("init if false");
      current_state = FSM_STATE.SEND_END;
    } else {
  //  dbg.logAndPrint("Protocol version: " + protocol_version);\
 // dbg.logAndPrint("init else false");
 //   console.log("else false")
      let filename = new Date()
        .toISOString()
        .replace(/T/, " ")
        .replace(/\..+/, "")
        .replace(/:/g, "")
        .replace(/ /g, "");
      device_info.setCurrentFilename(filename);
    //  dbg.logAndPrint("Filename: " + device_info.getCurrentFilename());
    }
  }
  if (current_state == FSM_STATE.FINISH_RECEIVING) {
   // dbg.logAndPrint("FSM_STATE.FINISH_RECEIVING");
  //  console.log("FSM_STATE.FINISH_RECEIVING")
    progress_bar.stop();
    emitdatatoSocket(device_info.getDeviceInfoData());

    temp_file_buff = Buffer.alloc(0);
    temp_file_buff = Buffer.concat([
      temp_file_buff,
      device_info.getFileBuffer()
    ]);
    let filePath = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
    
         
         
//     const file1Path = path.join(
//         __dirname,
//         device_info.getDeviceDirectory(),
//         /* device_info.getCurrentFilename() */ `${timestamp}` +
//           device_info.getExtension()
//       );
// const file2Path = path.join(
//     __dirname,
//     device_info.getDeviceDirectory(),
//     /* device_info.getCurrentFilename() */ `${timestamp}` +
//       '.bin'
//   );
  if(fs.existsSync(filePath)){ 
try {
    const filebuff = readJSONFile(filePath).buffer;
    let bufferData = Buffer.from(filebuff, "base64");
    let filePath2 = path.join(
        __dirname,
        device_info.getDeviceDirectory(),
        /* device_info.getCurrentFilename() */ `${timestamp}` +
          device_info.getExtension()
      );
    fs.writeFile(filePath2, bufferData, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
           // console.log("The file has been saved at:", file1Path);
            if (device_info.getExtension() == ".h265") {
              processVideoFile(device_info.getDeviceDirectory(), `${timestamp}`,`${frameratevideo}`,device_info.getExtension(),device_info.getFileToDL() ,device_info)
              }
              else {
                  processImageFile(`${timestamp}`,device_info)
              }
        }
      });


//   const sourceData = fs.readFileSync(filePath);
//   let buffer = Buffer.from(sourceData, "base64");
//   //console.log("in 222")
//   fs.truncate(file1Path, 0, (err) => {
//     if (err) {
//         console.error(`Error truncating file ${file1Path}:`, err);
//     } else {
//        // console.log(`File ${file1Path} has been truncated.`);

//   fs.writeFile(file1Path, buffer, (err) => {
//     if (err) {
//         console.error("Error writing file:", err);
//     } else {
//        // console.log("The file has been saved at:", file1Path);
//         if (device_info.getExtension() == ".h265") {
//           processVideoFile(device_info.getDeviceDirectory(), `${timestamp}`,`${frameratevideo}`,device_info.getExtension(),device_info.getFileToDL() ,device_info)
//           }
//           else {
//               processImageFile(`${timestamp}`,device_info)
//           }
//     }
//   });
// }
// });
  
} catch (error) {
  console.log("error in",error)
}


device_info.resetReceivedPackageCnt();
    device_info.clearBuffer();

    current_state = FSM_STATE.LOOK_FOR_FILES;

}
else {
  console.log("else in")
//   if (device_info.getExtension() == ".h265") {
//     processVideoFile(device_info.getDeviceDirectory(), `${timestamp}`,`${frameratevideo}`,device_info.getExtension(),device_info.getFileToDL() ,device_info)
//     }
//     else {
//         processImageFile(`${timestamp}`,device_info)
//     }
}
    
    device_info.resetReceivedPackageCnt();
    device_info.clearBuffer();

    current_state = FSM_STATE.LOOK_FOR_FILES;
    //s3
  }
  if (current_state == FSM_STATE.SEND_FILEPATH) {
   // console.log("FSM_STATE.SEND_FILEPATH")
    
  //  dbg.logAndPrint("FSM_STATE.SEND_FILEPATH");
 //   dbg.logAndPrint("Requesting file...");
    device_info.clearBuffer();
    device_info.setLastCRC(0);
    if (device_info.getCameraType() == CAMERA_TYPE.DUALCAM) {
      const query = Buffer.from([0, 8, 0, 7, 0, 0, 0, 0, 0, 0, 0]);

      query.write(device_info.getFileToDL(), 4);
   //   dbg.log("[TX]: [" + query.toString("hex") + "]");
      connection.write(query);
    }
    if (
      device_info.getCameraType() == CAMERA_TYPE.ADAS ||
      device_info.getCameraType() == CAMERA_TYPE.DSM
    ) {
      let query = Buffer.concat([
        Buffer.from([0, 8, 0, device_info.getFileToDL().length]),
        Buffer.from(device_info.getFileToDL())
      ]);
    //  dbg.log("[TX]: [" + query.toString("hex") + "]");
      connection.write(query);
    }
    current_state = FSM_STATE.WAIT_FOR_CMD;
  }
  if (current_state == FSM_STATE.REPEAT_PACKET) {
    //dbg.logAndPrint("FSM_STATE.REPEAT_PACKET");
    //console.log("FSM_STATE.REPEAT_PACKET")
    
    device_info.sync_received = false;

  

    let filePath2 
    try {
      filePath2 = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
    } catch (error) {
      console.log(error)
    }
   
    if(fs.existsSync(filePath2)){
    let packagescnt ;

        let jsonReaddata = readJSONFile(filePath2)
   
        pkgscount = jsonReaddata.lastreceivedPackages
    let offset = jsonReaddata.lastreceivedPackages //device_info.getReceivedPackageCnt();
   // console.log("ssd", offset,totallastreceivedPackages)
    let query = Buffer.from([0, 2, 0, 4, 0, 0, 0, 0]);
    if (
      device_info.getCameraType() == CAMERA_TYPE.DUALCAM &&
      device_info.getProtocolVersion() <= 5
    ) {
     // offset = offset ;
     let offsetNum = parseInt(offset, 10)
     offsetNum +=1
     offset = offsetNum.toString()
    }
    query.writeUInt32BE(offset, 4);
   
    // dbg.logAndPrint(
    //   "Requesting for a repeat of last packet: " + offset.toString()
    // );
    // dbg.log("[TX]: [" + query.toString("hex") + "]");
  //  console.log("[TX]: [" + query.toString("hex") + "]"+offset)
    connection.write(query);
  //  console.log("vd",  connection.write(query))
    device_info.repeat_sent_ts = Date.now();
    device_info.repeat_count++;
   //   })
    }
    else {
      let offset = device_info.getReceivedPackageCnt();
  //  console.log("ssd", offset)
    let query = Buffer.from([0, 2, 0, 4, 0, 0, 0, 0]);
    if (
      device_info.getCameraType() == CAMERA_TYPE.DUALCAM &&
      device_info.getProtocolVersion() <= 5
    ) {
     // offset = offset ;
     let offsetNum = parseInt(offset, 10)
     offsetNum +=1
     offset = offsetNum.toString()
    }
    query.writeUInt32BE(offset, 4);
  
    connection.write(query);
   // console.log("vd",  connection.write(query))
    device_info.repeat_sent_ts = Date.now();
    device_info.repeat_count++;
      
    }
  }
  if (current_state == FSM_STATE.SEND_METADATA_REQUEST) {
  //  dbg.logAndPrint("Requesting metadata...");
  //console.log("FSM_STATE.SEND_METADATA_REQUEST")
  //dbg.logAndPrint("FSM_STATE.SEND_METADATA_REQUEST");
    let query = 0;
    if (device_info.getCameraType() == CAMERA_TYPE.DUALCAM) {
      query = Buffer.from([0, 10, 0, 7, 0, 0, 0, 0, 0, 0, 0]);
      query.write(device_info.getFileToDL(), 4);
    } else {
      query = Buffer.from([0, 10, 0, 0]);
    }
  //  dbg.log("[TX]: [" + query.toString("hex") + "]");
    connection.write(query);
    
    current_state = FSM_STATE.WAIT_FOR_CMD;
  }
  if (current_state == FSM_STATE.SEND_COMPLETE) {
   // dbg.logAndPrint("Completing upload");
  //console.log("FSM_STATE.SEND_COMPLETE")

   //dbg.logAndPrint("FSM_STATE.SEND_COMPLETE");
    // Close session
    const query = Buffer.from([0, 5, 0, 4, 0, 0, 0, 0]);
   // dbg.log("[TX]: [" + query.toString("hex") + "]");
    connection.write(query);
  
    device_info.setTotalPackages(0);
    device_info.resetReceivedPackageCnt();
    device_info.setLastCRC(0);
    device_info.setCameraType(CAMERA_TYPE.NONE);

    //s3

    current_state = FSM_STATE.END;
  }
  if (current_state == FSM_STATE.LOOK_FOR_FILES) {
   // console.log("FSM_STATE.LOOK_FOR_FILES")
  //  dbg.logAndPrint("FSM_STATE.LOOK_FOR_FILES");

    const query = Buffer.from([0, 9]);
   // dbg.log("[TX]: [" + query.toString("hex") + "]");
    connection.write(query);
    
    current_state = FSM_STATE.INIT;
  }
  if (current_state == FSM_STATE.SEND_END) {
   // dbg.logAndPrint("FSM_STATE.LOOK_FOR_FILES");
   // console.log("FSM_STATE.SEND_END")
  ///  dbg.logAndPrint("Closing session");
    const query = Buffer.from([0, 0, 0, 0]);
  ///  dbg.log("[TX]: [" + query.toString("hex") + "]");
    connection.write(query);
    
    current_state = FSM_STATE.END;
  }
  return current_state;
};
