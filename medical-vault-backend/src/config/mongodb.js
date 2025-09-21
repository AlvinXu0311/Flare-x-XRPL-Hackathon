const mongoose = require('mongoose');

const connectMongoDB = async () => {
  try {
    // MongoDB connection string with your credentials
    const mongoURI = `mongodb+srv://sd1f080302_db_user:KfR7LlQrltanHwCx@cluster0.mongodb.net/medical-vault?retryWrites=true&w=majority`;

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

module.exports = { connectMongoDB };