// const data = "ba,7e,0c,36,fd,ca,15,57,87,9e,f2,51,07,00,96,11,54,6c,42,98,51,8a,f4,55,06,6e,de,35,2b,3f,88,68,17,c5,0d,48,2c,2d,f4,e3,18,b5,1e,cf,85,cd,e5,4c,2e,bb,8d,0f,64,90,38,35,02,ba,cf,ca,d8,fa,22,e2,5a,0c,37,8e,48,44,bf,67,a3,f1,fc,62,c0,17,83,22,78,71,99,42,90,bc,06,2e,13,a9,78,22,9c,dd,4b,39,7f,99,bf,8f,36,48,e5,e0,de,70,81,94,74,e9,78,a4,02,64,44,d3,f3,fa,6f,6f,d4,57,09,46,7a,67,08,b1,78,28,4b,a0,c3,a9,22,63,94,9d,77,b4,25,e7,15,17,f8,29,64,c8,8a,5a,57,44,15,ce,f4,19,01,6a,dd,79,2d,ad,f3,da,10,3a,08,57,2a,64,df,9d,b0,89,1a,f7,f7,ad,dc,52,b4,f2,53,4d,ee,70,e8,27,1c,b6,ba,e1,cf,8c,34,d7,48,54,54,03,53,eb,09,19,ae,8b,d2,34,5f,39,5b,a4,68,ab,24,ef,42,57,ca,a4,fb,a2,ab,70,b9,ef,9b,ce,4f,ab,70,cb,d8,3a,f8,ab,34,f6,52,bb,ca,44,d3,62,bd,9c,f5,44,03,7e,0e,bc,42,d1,16,c6,c7,67,a7,73,ab,a4,d5,a3,ce,be,f6,d7,64,c1,da,1d,52,af,91,34,70,94,4b,c7,22,15,32,e0,a5,b8,7d,4e,2a,69,ae,25,8b,f5,08,3a,68,49,3d,1c,c7,70,3e,4d,9a,91,fb,da,49,f7,df,71,5f,34,03,c5,bf,f4,37,e6,e5,80,bd,5f,86,2b"
// function calculateLength(data) {
//     // Split the string by commas and return the length of the resulting array
//     return data.split(',').length;
// }

// const length = calculateLength(data);
// console.log(length);

// const fs = require('fs');
// const path = require("path");
// function readDataFromFile(inputFilePath) {
//     return new Promise((resolve, reject) => {
//         fs.readFile(inputFilePath, 'utf8', (err, data) => {
//             if (err) {
//                 return reject(err);
//             }
//             resolve(JSON.parse(data));
//         });
//     });
// }

// function writeDataToFile(outputFilePath, packets) {
//     return new Promise((resolve, reject) => {
//         const packetData = packets.map(packet => packet.data);
//         fs.writeFile(outputFilePath, packetData, 'utf8', (err) => {
//             if (err) {
//                 return reject(err);
//             }
//             resolve();
//         });
//     });
// }

// async function processPackets() {
//     try {
//         const inputFilePath = path.join(
//             __dirname,
//             's.json'
//           );
//         //const inputFilePath = 'p.json';
//         const outputFilePath = 'output.jpeg';

//         const jsonData = await readDataFromFile(inputFilePath);
//         const packets = jsonData.packets;

//         await writeDataToFile(outputFilePath, packets);
//         console.log(`Data written to ${outputFilePath}`);
//     } catch (error) {
//         console.error('Error processing packets:', error);
//     }
// }

// processPackets();

function calculateTimeDifference(startTime, endTime) {
    // Check if both inputs are valid numbers
    if (typeof startTime !== 'number' || typeof endTime !== 'number') {
        throw new Error("Both startTime and endTime should be valid numbers.");
    }

    // Calculate the difference in milliseconds
    const differenceInMillis = endTime - startTime;

    // Convert milliseconds to seconds
    const differenceInSeconds = Math.floor(differenceInMillis / 1000);

    return differenceInSeconds;
}

// Example usage
const startTimestamp = 1730362610504; // Example start time in Unix timestamp
const endTimestamp = 1730362620863; // Example end time in Unix timestamp

const timeDifference = calculateTimeDifference(startTimestamp, endTimestamp);
console.log(`Time difference in seconds: ${timeDifference}`); // Output: 100


// const fs = require('fs');
// const path = require('path');

// // Define the file path
// const filePath = path.join(__dirname, 'data1.json');
// // Function to read the JSON file
// const readJSONFile = (filePath) => {
//     if (fs.existsSync(filePath)) {
//         const data = fs.readFileSync(filePath, 'utf-8');
//         return JSON.parse(data);
//     }
//     return null; // Return null if the file doesn't exist
// };

// // Function to write the JSON file
// const writeJSONFile = (filePath, data) => {
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
// };

// // Function to update the JSON file with new values
// const updateJSONFile = (newValues) => {
//     // Read the existing data
//     const jsonData = readJSONFile(filePath) || {}; // Read existing data or use an empty object

//     // Update attributes with new values
//     jsonData.timestamp = newValues.timestamp || jsonData.timestamp;
//     jsonData.totalPackages = (jsonData.totalPackages || 0) + (newValues.totalPackages || 0);
//     jsonData.receivedPackages = (jsonData.receivedPackages || 0) + (newValues.receivedPackages || 0);
//     jsonData.lastCrc = newValues.lastCrc || jsonData.lastCrc;
//     jsonData.lastReceivedPackages = (jsonData.lastReceivedPackages || 0) + (newValues.lastReceivedPackages || 0);

//     // Append new values to the buffer
//     if (newValues.buffer && Array.isArray(newValues.buffer)) {
//         jsonData.buffer = jsonData.buffer || []; // Initialize buffer if it doesn't exist
//         jsonData.buffer.push(...newValues.buffer);
//     }

//     // Write the updated data back to the file
//     writeJSONFile(filePath, jsonData);
// };
// let d = ["23","54", "43"]
// // Example usage
// const newValues = {
   
//     totalPackages: 4,
//     receivedPackages: 3,
//     lastCrc: 10,
//     lastReceivedPackages: 2,
//     buffer: d
// };

// //updateJSONFile(newValues);
// //console.log('JSON file updated successfully.');

// //const t = readJSONFile(filePath).buffer.join(', ');
// writeJSONFile(filePath, newValues);
// //onsole.log("tttt", t);