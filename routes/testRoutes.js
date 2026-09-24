const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');

router.get('/cloudinary', async (req, res) => {
  try {
    console.log('=== TESTING CLOUDINARY ===');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    
    const result = await cloudinary.api.ping();
    
    res.json({
      success: true,
      cloudinary: result,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
      apiSecret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING',
    });
  } catch (error) {
    console.error('Cloudinary Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
      apiSecret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING',
    });
  }
});

module.exports = router;