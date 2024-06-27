const { exec } = require("child_process");

exports.ConvertVideoFile=(directory, frameratevideo, filename, extension)=>{
    return new Promise((resolve, reject) => {
    
      console.log("SD", `${directory}/${filename}${extension}`);
  
     const form_command = `ffmpeg -hide_banner -loglevel quiet -r ${frameratevideo} -i "${directory}//${filename}${extension}" -ss 00:00:0.9 -c:a copy -c:v libx264 -preset ultrafast  "${directory}/${filename}.mp4"`;
     // let form_command = `ffmpeg -hide_banner -loglevel quiet -r " ${frameratevideo} " -i \"" "${directory}//${filename}${extension}" -ss 00:00:0.9 -c:a copy -c:v libx264 \"" "${directory}/${filename}.mp4"`;
   
      exec(form_command, (error, stdout, stderr) => {
        if (error) {
          // console.log(`Error: ${error.message}`);
          return   reject(`Error: ${error.message}`);
        }
        if (stderr) {
          // console.log(`Stderr: ${stderr}`);
        }
        console.log(
          `Conversion completed successfully. "${filename}${extension}"`
        );
        return resolve(`Stderr: ${stderr}`);
  
      });
    });
  }