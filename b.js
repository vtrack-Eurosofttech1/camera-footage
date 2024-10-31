
const fs = require("fs");
const path = require("path");
const { uploadToS3 } = require("./uploadToS3.js");
const { ConvertVideoFile } = require("./ConvertVideoFile.js");
let timestamp = 1730362569000
let filePath = path.join(__dirname, 'downloads/863719061653375',`${timestamp}` + '.json');
    console.log(filePath)

    const readJSONFile = (filePath) => {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
        return null; // Return null if the file doesn't exist
      };
  if(fs.existsSync(filePath)){ 
try {
    const filebuff = readJSONFile(filePath).buffer
    //console.log(filebuff)
    let b = filebuff
    const buffera = Buffer.from(b, "base64")
    console.log(buffera)
   // let bufferData = Buffer.from(filebuff, "base64");
    let filePath2 = path.join(
        __dirname,
        
        /* device_info.getCurrentFilename() */ `${timestamp}` +
          '.jpeg'
      );
    fs.writeFile(filePath2, buffera, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
            console.log("The file has been saved at:", filePath2);
            // if (device_info.getExtension() == ".h265") {
            //   processVideoFile(device_info.getDeviceDirectory(), `${timestamp}`,`${frameratevideo}`,device_info.getExtension(),device_info.getFileToDL() ,device_info)
            //   }
            //   else {
            //       processImageFile(`${timestamp}`,device_info)
            //   }
        }
      });
  
} catch (error) {
  console.log("error in",error)
}


// device_info.resetReceivedPackageCnt();
//     device_info.clearBuffer();

//     current_state = FSM_STATE.LOOK_FOR_FILES;

}
else {
  console.log("else in")

}