const fs = require("fs");
const path = require("path");
const { ConvertVideoFile } = require("./ConvertVideoFile");
const { uploadToS3 } = require("./uploadToS3");
//const emitdatatoSocket = require("./socket");
/* var timestamp = "1725366533000"
const file1Path = path.join(
    __dirname,
    `downloads/863719061653375/${timestamp}.h265`
  );
const file2Path = path.join(
__dirname,
`downloads/863719061653375/${timestamp}.bin`
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
        `${timestamp}`,
         '.h265'
        ).then(async(d)=>{
console.log("convert", d);
const IMEI = "downloads/863719061653375"
    const fileName = `${timestamp}.mp4`;
    const filePath = path.join(__dirname, IMEI, fileName);
try {
    await fs.readFile(filePath,async(err,data)=>{
        let directory = "863719061653375"
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
} */

const videoConversion = (imei,timestamp) =>{
    let Timestamp = timestamp
    let deviceIMEI = imei
    const file1Path = path.join(
        __dirname,
        `downloads/${deviceIMEI}/${Timestamp}.h265`
      );
    const file2Path = path.join(
    __dirname,
    `downloads/${deviceIMEI}/${Timestamp}.bin`
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
                `downloads/${deviceIMEI}`,
                20,
                `${timestamp}`,
                 '.h265'
                ).then(async(d)=>{
        console.log("convert", d);
        const IMEI =`downloads//${deviceIMEI}`
            const fileName = `${timestamp}.mp4`;
            const filePath = path.join(__dirname, IMEI, fileName);
        try {
            await fs.readFile(filePath,async(err,data)=>{
                let directory = deviceIMEI
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


}

function checkVideoPlayback(videoUrl) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');

        // Set the video source
        video.src = videoUrl;

        // Listen for the 'canplaythrough' event
        video.addEventListener('canplaythrough', () => {
            video.pause(); // Pause after it can play through
            resolve(true); // Video is playable
        });

        // Listen for error events
        video.addEventListener('error', (event) => {
            // If an error occurs, reject the promise
            reject(new Error('Video playback error: ' + event.message));
        });

        // Load the video
        video.load();

        // Optional: Set a timeout to reject if it takes too long
        setTimeout(() => {
            reject(new Error('Video took too long to load.'));
        }, 10000); // 10 seconds timeout
    });
}





export { videoConversion, checkVideoPlayback };
/* 
let payload ={ 
    clientId: "64f9c5c3b7f9957d81e36908",
    message: "hello device"
    
}
setInterval(()=>{
    emitdatatoSocket(payload);

}, 1000) */