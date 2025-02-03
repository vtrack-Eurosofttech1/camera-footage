const ffmpeg = require('fluent-ffmpeg');
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const inputFile = '/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/1733825285000.h265'
//const inputFile = '/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/1731073507000.h265'
// const inputFile = '/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/1730975160000.h265';

const outputFile = '/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/1733825285000';
// const data = fs.readFileSync(outputFile);
// fs.writeFileSync('/home/eurosofttech/camera_server/camera-footage/downloads/863719061653375/1731078866000new.h265',data );


const main = () => {
  ffmpeg(inputFile)
      .outputOptions([
          '-c:v libx264',         // Use H.264 codec for MP4
          '-crf 20',              // Set constant quality
          '-preset slow',         // Slower encoding for better compression
          '-movflags +faststart', // Optimize for web streaming
          '-r 30',                // Set frame rate (adjust to your input frame rate)
        //  '-vf "fps=30"',         // Apply frame rate filter
          '-shortest'             // Ensure output duration matches input
      ])
      .on('start', (cmd) => {
          console.log(`Started ffmpeg with command: ${cmd}`);
      })
      .on('error', (err, stdout, stderr) => {
          console.error('Error:', err.message);
          console.error('ffmpeg stdout:', stdout);
          console.error('ffmpeg stderr:', stderr);
      })
      .on('end', () => {
          console.log('Conversion completed!');
      })
      .save(outputFile);
};

//  main()

function convertH265ToMp4(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
    .output(outputFile)
    .videoCodec('libx264')
    .outputOptions('-r 20') 
      .on('start', (commandLine) => {
        console.log('Spawned FFMPEG with command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log('Conversion completed successfully!');
        resolve();
      })
      .on('error', (err) => {
        console.error('An error occurred:', err.message);
        reject(err);
      })
      .run();
  });
}


// convertH265ToMp4(inputFile, outputFile)
//   .then(() => console.log('File converted successfully'))
//   .catch((err) => console.error('Error during conversion:', err));
function ConvertVideoFile(outputFile, inputFile) {
  framerate = "20";
  // if (metadata_option == METADATA_TYPE.AT_START) {
  //     framerate = metadata.getFramerate();
  // }
  let form_command = "ffmpeg -hide_banner -loglevel quiet -r " + framerate + " -i \"" + inputFile + "\" -ss 00:00:0.9 -c:a copy -preset slow -c:v libx264 \"" + outputFile  + ".mp4\"";
  //let form_command = `ffmpeg -hide_banner -loglevel quiet  -r " + {framerate} + " -i  -ss 00:00:0.9 -i "${inputFile}" -c:a copy -preset slow -c:v libx264 "${outputFile}.mp4"`;
  exec(form_command, (error, stdout, stderr) => {
      if (error) {
          dbg.error(`Error: ${error.message}`);
          return;
      }
      if (stderr) {
          dbg.error(`Stderr: ${stderr}`);
          return;
      }
  });
}
ConvertVideoFile(outputFile,inputFile)