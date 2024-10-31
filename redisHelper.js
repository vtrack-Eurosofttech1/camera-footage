const redis = require('redis');

module.exports = async function redisHelper() {
    const REDISURL = 'redis://127.0.0.1:6379'; 

    const redisClient = redis.createClient({
        url: REDISURL,
    });

    redisClient.on("error", (error) => {
        console.log("Redis error:", error);
    });

    redisClient.on("ready", () => {
        console.log("Redis client is ready");

    });

    await redisClient.connect();
    
    

    return redisClient;
};
