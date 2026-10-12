const mongoose = require("mongoose");

let connectionPromise;

async function connectMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGO_URI) {
    const error = new Error("MONGO_URI environment variable is not configured");
    error.status = 503;
    throw error;
  }
  if (!connectionPromise || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

function ensureMongo(_req, _res, next) {
  connectMongo().then(() => next()).catch(next);
}

module.exports = { connectMongo, ensureMongo };
