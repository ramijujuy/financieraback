const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no definida");
  }

  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
  console.log("MongoDB conectado");
};

module.exports = connectDB;
