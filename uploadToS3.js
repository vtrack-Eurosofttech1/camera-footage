const AWS = require("aws-sdk");
const { ObjectId } = require("mongodb");
const s3 = new AWS.S3({
  accessKeyId: "AKIAYYM3CIEBEKPUNDEU",
  secretAccessKey: "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",
  region: "eu-west-2",
});
var MongoClient = require("mongodb").MongoClient;
const url =
  "mongodb+srv://Wrapper:D2zQcgJvtnKS4Jkr@vtracksolutions.nih4b.mongodb.net/VtrackV1?retryWrites=true&w=majority";

exports.uploadToS3 =(params,payload)=>{
    let {fileName,fileType,deviceIMEI}=payload
   
    try{
        s3.upload(params, function (s3Err, fileContent) {
            if (s3Err) {
                console.log("Error",s3Err)
                return 
            }

            uploadedPath = fileContent.Location;
            console.log(`File uploaded successfully at ${uploadedPath}`);

            MongoClient.connect(url, function (err, db) {
              if (err) throw err;
              var dbo = db.db("VtrackV1");
              dbo
                .collection("devices")
                .findOne(
                  { deviceIMEI},
                  function (err, fetchedDevice) {
                    if (fetchedDevice != null && fetchedDevice != undefined) {
                      dbo
                        .collection("deviceassigns")
                        .findOne(
                          { DeviceId: fetchedDevice._id.toString() },
                          function (err, fetchedDeviceassign) {
                            if (
                              fetchedDeviceassign != null &&
                              fetchedDeviceassign != undefined
                            ) {
                              dbo.collection("vehicles").findOne(
                                {
                                  _id: ObjectId(fetchedDeviceassign.VehicleId),
                                },
                                function (err, fetchedVehicle) {
                                  if (
                                    fetchedVehicle != null &&
                                    fetchedVehicle != undefined
                                  ) {
                                    var videoListObject = {};
                                    videoListObject["clientId"] =
                                      fetchedDeviceassign.clientId;
                                    videoListObject["dateTime"] = new Date();

                                    videoListObject["fileType"] = fileType;
                                    videoListObject["fileName"] = fileName;
                                    videoListObject["Vehicle"] =
                                      fetchedVehicle.vehicleReg;
                                    videoListObject["path"] = uploadedPath;
                                    videoListObject["isSeen"] = false;

                                    dbo
                                      .collection("videolists")
                                      .insertOne(
                                        videoListObject,
                                        function (err, res) {
                                          if (err) throw err;
                                          console.log("1 document inserted");
                                          // db.close();
                                        }
                                      );
                                  }
                                }
                              );
                            }
                          }
                        );
                    }
                  }
                );
            });
          });
    }catch(e){}
}