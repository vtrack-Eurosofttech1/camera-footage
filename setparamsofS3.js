const fs = require("fs");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");
const protocol = require("./protocol.js");


let device_info = new protocol.DeviceDescriptor();

async function processVideoFile(device_info_directory, timestamp, frameratevideo, extension,getFileToDL) {
    const IMEI = device_info_directory;
    const fileName = `${timestamp}.mp4`;
    const filePath = path.join(__dirname, IMEI, fileName);
  
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath);
    } catch (e) {
      console.error('Error reading video file:', e.message);
      return;
    }
  
    let params = {
        Bucket: "vtracksolutions/media", // pass your bucket name
        Key: directory + "/" + `${timestamp}` + ".mp4",

        // Body: fileContent,
        ContentType: "video/mp4"
      };
  
    try {
      await ConvertVideoFile(
        device_info_directory,
        frameratevideo,
        timestamp,
         extension
      );
  
      console.log("Video conversion successful");
  
      await uploadToS3(params, {
        fileType: 2,
        fileName: fileName,
        deviceIMEI: IMEI,
        filePath: filePath,
        cameraType: getFileToDL
      });
  
      device_info.setUploadedToS3(true);
    } catch (error) {
      console.error("Error converting or uploading video:", error);
    }
  }

  
  async function processImageFile(timestamp) {
    const IMEI = device_info.getDeviceDirectory();
    const fileName = `${timestamp}.jpeg`;
    const filePath = path.join(__dirname, IMEI, fileName);
  
    let fileContent;
    try {
      fileContent = await fs.promises.readFile(filePath);
    } catch (err) {
      console.error('Error reading image file:', err.message);
      return;
    }
  
    const params = {
        Bucket: "vtracksolutions/media", // pass your bucket name
        Key: directory + "/" + `${timestamp}` + ".jpeg",
      Body: fileContent
    };
  
    try {
      await uploadToS3(params, {
        fileType: 1,
        fileName: fileName,
        deviceIMEI: IMEI,
        cameraType: device_info.getFileToDL()
      });
  
      device_info.setUploadedToS3(true);
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  }
  module.exports = {
    processVideoFile,
    processImageFile
  };