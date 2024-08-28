const fs = require("fs");
const path = require("path");
const { ConvertVideoFile } = require("./ConvertVideoFile");
const { uploadToS3 } = require("./uploadToS3");

const file1Path = path.join(
    __dirname,
    "downloads/863719061653375/1724839820000.h265"
  );
const file2Path = path.join(
__dirname,
"downloads/863719061653375/1724839820000.bin"
);
if(fs.existsSync(file1Path) && fs.existsSync(file2Path)){ 

console.log("in")
try {
const sourceData = fs.readFileSync(file2Path);
let buffer = Buffer.from(sourceData, "base64");
console.log("in 222")
fs.writeFile(file1Path, buffer, (err) => {
if (err) {
    console.error("Error writing file:", err);
} else {
    console.log("The file has been saved at:", file1Path);
    if (file1Path) {
     //processVideoFile(device_info.getDeviceDirectory(), `${timestamp}`,`${frameratevideo}`,device_info.getExtension(),device_info.getFileToDL() ,device_info)
     ConvertVideoFile(
        "downloads/863719061653375",
        20,
        "1724839820000",
         '.h265'
        ).then(async(d)=>{
console.log("convert", d);
const IMEI = "downloads/863719061653375"
    const fileName = `1724839820000.mp4`;
    const filePath = path.join(__dirname, IMEI, fileName);
try {
    await fs.readFile(filePath,async(err,data)=>{
        let directory = "863719061653375"
        let params = {
            Bucket: "vtracksolutions/media", // pass your bucket name
            Key: directory + "/" + `1724839820000` + ".mp4",
            Body: data,
            ContentType: "video/mp4"
          };
        
            console.log("Video conversion successful",params);
            
            await uploadToS3(params, {
              fileType: 2,
              fileName: fileName,
              deviceIMEI: IMEI.split("/").pop(),
              filePath: filePath,
              cameraType: "%videof"
            });
        

        
        }) } catch (error) {
    console.log("error====e",error)
}


        }).catch ((e) =>{
            console.log("EEE====e",e)
        })
        }
    }
})
    }

 catch (e){
    console.log("EEEe",e)
}
}