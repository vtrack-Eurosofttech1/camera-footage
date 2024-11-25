const net = require('net');
const fs = require('fs');
const path = require('path');

// Server connection details
const serverHost = '0.0.0.0';  // Bind to all interfaces
const serverPort = 7056;  // Port to listen for incoming connections

// Buffer to store the received image data
let imageBuffer = Buffer.alloc(0);

// Number of expected total packets (for this example, assume you know the total number)
let totalPackets = 0;
let receivedPackets = 0;

// Create TCP server
const server = net.createServer((socket) => {
  console.log('Client connected');

  socket.on('data', (data) => {
    // Process incoming data packet
    const cmdID = data.slice(0, 2).toString('hex');  // Extract command ID (2 bytes)
    const length = data.readUInt16BE(2);             // Extract length field (2 bytes)
    const chunkData = data.slice(4, 4 + length - 2); // Extract chunk data (skip the CMD_ID and Length)

    if (cmdID === '0004') {
      // If the CMD_ID matches '0004', it's a valid packet
      console.log(`Received packet ${receivedPackets + 1}`);
      
      // Append the chunk data to the imageBuffer
      imageBuffer = Buffer.concat([imageBuffer, chunkData]);
      receivedPackets++;

      // If all packets are received, save the image file
      if (receivedPackets === totalPackets) {
        console.log('All packets received. Saving image...');
        fs.writeFileSync(path.join(__dirname, 'received_image.jpeg'), imageBuffer);
        console.log('Image saved as received_image.jpeg');
      }
    }
  });

  socket.on('end', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('Connection error:', err);
  });

});

// Start the server
server.listen(serverPort, serverHost, () => {
  console.log(`Server listening on ${serverHost}:${serverPort}`);
});
