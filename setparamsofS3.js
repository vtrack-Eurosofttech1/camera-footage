const fs = require("fs");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");
const protocol = require("./protocol.js");




async function processVideoFile(device_info_directory, timestamp, frameratevideo, extension,getFileToDL,device_info) {
    // let device_info = new protocol.DeviceDescriptor();
    const IMEI = device_info_directory;
    const fileName = `${timestamp}.mp4`;
    const filePath = path.join(__dirname, IMEI, fileName);
  
    try {
      await ConvertVideoFile(
        device_info_directory,
        frameratevideo,
        timestamp,
         extension
        ).then(async(d)=>{

    
    try {
  fs.readFileSync(filePath,async(err,d)=>{

    let directory = IMEI.split("/").pop();
    let params = {
        Bucket: "vtracksolutions/media", // pass your bucket name
        Key: directory + "/" + `${timestamp}` + ".mp4",
        Body: d,
        ContentType: "video/mp4"
      };
  
        console.log("Video conversion successful");
    
        await uploadToS3(params, {
          fileType: 2,
          fileName: fileName,
          deviceIMEI: IMEI.split("/").pop(),
          filePath: filePath,
          cameraType: getFileToDL
        });
    
        device_info.setUploadedToS3(true);
  });
    } catch (e) {
      console.error('Error reading video file:', e.message);
      return;
    }
    

      }).catch((err)=>{
        console.log("Error: ",err)
      })
  
    } catch (error) {
      console.error("Error converting or uploading video:", error);
    }
  }

  
  async function processImageFile(timestamp,device_info) {
    // let device_info = new protocol.DeviceDescriptor();
    const IMEI = device_info.getDeviceDirectory();
  
    const fileName = `${timestamp}.jpeg`;
    const filePath = path.join(__dirname, IMEI, fileName);
    console.log(__dirname, IMEI, fileName)
  console.log("afa", filePath)
  let deviceInfo = device_info.getDeviceDirectory();
      let directory = deviceInfo.split("/").pop();
    let fileContent;
    try {
      fs.readFile(filePath,async (e,d)=>{
        fileContent=d
        const params = {
          Bucket: "vtracksolutions/media", // pass your bucket name
          Key: directory + "/" + `${timestamp}` + ".jpeg",
        Body: fileContent
      };
    console.log(params)
      try {
        await uploadToS3(params, {
          fileType: 1,
          fileName: fileName,
          deviceIMEI: IMEI.split("/").pop(),
          cameraType: device_info.getFileToDL()
        });
    
        device_info.setUploadedToS3(true);
      } catch (error) {
        console.error("Error uploading image:", error);
      }
      });
    } catch (err) {
      console.error('Error reading image file:', err.message);
      return;
    }
  
    
  }
  module.exports = {
    processVideoFile,
    processImageFile
  };