const fs = require("fs");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");





// Function to update the JSON file with new values
const updateJSONFile =async (newValues,filePath,redisClient) => {
  filePath = filePath.toString()
  let b =JSON.parse(await redisClient.get(filePath))

    redisClient.set(filePath,JSON.stringify({...b,...newValues}))


  
};

async function saveDataToJson(device_info,filePath, redisClient) {
  try {
    filePath = filePath.toString();
    const data = await redisClient.get(filePath);
    
    if (data) {
    
      const jsonData = JSON.parse(data);
      
    
      const outputFilePath = path.join(__dirname, device_info.getDeviceDirectory(),`${filePath}.json`); 
     
      
      // Write the data to a JSON file
      fs.writeFile(outputFilePath, JSON.stringify(jsonData, null, 2), (err) => {
        if (err) {
          console.error('Error writing to file', err);
        } else {
          console.log('Data successfully written to', outputFilePath);
        }
      });
    } else {
      console.log('No data found for the specified key in Redis.');
    }
  } catch (error) {
    console.error('Error fetching data from Redis', error);
  }
}


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
console.log("convert", d);
    
    try {
  await fs.readFile(filePath,async(err,data)=>{

    if(err){
      console.log("err err", err);
    }

    let directory = IMEI.split("/").pop();
    let params = {
        Bucket: "vtracksolutions/media", // pass your bucket name
        Key: directory + "/" + `${timestamp}` + ".mp4",
        Body: data,
        ContentType: "video/mp4"
      };
  
        console.log("Video conversion successful",params);
    
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

  
  async function processImageFile(timestamp,device_info,redisClient) {
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
          filePath: filePath,

          cameraType: device_info.getFileToDL()
        });
    
        device_info.setUploadedToS3(true);
       // let filePath1 = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
        
        let newData = {
            
          uploadedToS3: true,
          
          }
          await updateJSONFile(newData, timestamp, redisClient);
          await saveDataToJson(device_info, timestamp, redisClient)
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