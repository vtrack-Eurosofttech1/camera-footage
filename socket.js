const { Server } = require("socket.io");
// const https = require("https");
const server = require("https");
const fs = require("fs");

const certPath = "./certs/server_cert.pem"
const keyPath = "./certs/server_key.pem"
var httpsOptions = {
    key: fs.readFileSync(keyPath, 'utf8'),
    cert: fs.readFileSync(certPath, 'utf8')
  };


const WEB_SERVER_PORT = 7057;
const httpsServer = server.createServer(httpsOptions);
const io = new Server({ cors: { origin: "*" } });

httpsServer.listen(WEB_SERVER_PORT, () => {
    console.log("Socket Server is running on port " + WEB_SERVER_PORT);
});
io.listen(httpsServer)

io.on("connection", (socket) => {
    console.log("A client connected:", socket.id,socket.handshake.query);
    // socket._onclose((e)=>{
    //     console.log(".....",e)
    // })
});

function emitdatatoSocket(payload) {
    const { clientId } = payload;
 //  console.log("afcbsdjfcd", payload)
    io.fetchSockets().then((sockets) => {
       // console.log(sockets)
        
        sockets.forEach((socket) => {
            if (clientId == socket.handshake.query.clientId) {
               // console.log("====", payload)
            //    let progress = (payload.received_packages/payload.total_packages)*100
                socket.emit("message", payload);
            }
        });
    });
}

module.exports = emitdatatoSocket;
