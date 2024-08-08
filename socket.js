const { Server } = require("socket.io");
const http = require("http");

const WEB_SERVER_PORT = 7057;
const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

httpServer.listen(WEB_SERVER_PORT, () => {
    console.log("Socket Server is running on port " + WEB_SERVER_PORT);
});

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
