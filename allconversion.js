


const fs = require("fs");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");


const readJSONFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    return null; // Return null if the file doesn't exist
  };
  
  // Function to write the JSON file
  const writeJSONFile = (filePath, data) => {
   // console.log("ss",filePath, data)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  };
  // Function to update the JSON file with new values
  const updateJSONFile = (newValues,filePath) => {
    // Read the existing data
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

const convertAndUplaodToS3 = (timestamp,Extension)=> { 
let filePath = path.join("/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/", `${timestamp}` + '.json');
    
  if(fs.existsSync(filePath)){ 
try {
    let filedata = readJSONFile(filePath)
    const filebuff = filedata.buffer;
    let bufferData = Buffer.from(filebuff, "base64");
    let filePath2 = path.join(
        "/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/",
        /* device_info.getCurrentFilename() */ `${timestamp}` +
          Extension
      );
    fs.writeFile(filePath2, bufferData, async(err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
           // console.log("The file has been saved at:", file1Path);
            if (Extension == ".h265") {
             // processVideoFile(device_info.getDeviceDirectory(), `${timestamp}`,`${frameratevideo}`,Extension, ,device_info)
             const IMEI = "/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/";
             const fileName = `${timestamp}.mp4`;
             const filePath = path.join( IMEI, fileName);
           
             try {
               await ConvertVideoFile(
                IMEI,
                filedata.framerate,
                 timestamp,
                 Extension
                 ).then(async(d)=>{
         console.log("convert", d);
             
             try {
           await fs.readFile(filePath,async(err,data)=>{
         
             if(err){
               console.log("err err", err);
             }
         
             let directory = "863719061653375";
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
                   deviceIMEI: "863719061653375",
                   filePath: filePath,
                   cameraType: filedata.camera_type
                 });
                 //device_info.setUploadedToS3(true);
                 let filePath1 = path.join("/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/", `${timestamp}` + '.json');
                 
                 let newData = {
                     
                   uploadedToS3: true,
                   
                   }
                   await updateJSONFile(newData, filePath1);
               //  device_info.setUploadedToS3(true);
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
              else {
                const IMEI = "/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/";
                let filePath1 = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
                let filedata = readJSONFile(filePath1)
                const fileName = `${timestamp}.jpeg`;
                const filePath = path.join( IMEI, fileName);
               // console.log(__dirname, IMEI, fileName)
            //  console.log("afa", filePath)
            
                  let directory = "863719061653375"
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
                      deviceIMEI: "863719061653375",
                      filePath: filePath,
            
                      cameraType: filedata.camera_type
                    });
                
                    // device_info.setUploadedToS3(true);
                    // let filePath1 = path.join(__dirname, device_info.getDeviceDirectory(), `${timestamp}` + '.json');
                    
                    let newData = {
                        
                      uploadedToS3: true,
                      
                      }
                      await updateJSONFile(newData, filePath1);
                  } catch (error) {
                    console.error("Error uploading image:", error);
                  }
                  });
                } catch (err) {
                  console.error('Error reading image file:', err.message);
                  return;
                }
              }
        }
      });

} catch (error) {
  console.log("error in",error)
}
  }
}

convertAndUplaodToS3(1730454640000,".h265")

// let filePath = path.join("/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/", `${1730444833000}` + '.json');
// function writeJSONFile1(filePath, data) {
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
// }
//     let filedata = readJSONFile(filePath).packets
//     let buff = filedata.map(item => item.data).join('');
// //console.log("buff", buff)
//     let filePath1 = path.join("/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/", `new` + '.h265');
//     let base64Data = Buffer.from(buff).toString('base64');
//     writeJSONFile1(filePath1,  base64Data );
   