/**
 * MongoDB Atlas Connection
 * Retries up to 5 times with exponential back-off before exiting.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  let retries = 5;

  while (retries > 0) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      retries -= 1;
      console.error(`❌ MongoDB connection failed. Retries left: ${retries}`);
      console.error(`   ${err.message}`);

      if (retries === 0) {
        console.error('❌ All MongoDB connection attempts exhausted. Exiting.');
        process.exit(1);
      }

      // Exponential back-off: 1s, 2s, 3s, 4s, 5s
      const wait = (6 - retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
};

module.exports = connectDB;
