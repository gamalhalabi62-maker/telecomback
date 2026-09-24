const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing Cloudinary env vars:', missing.join(', '));
  console.error('⚠️  Image uploads will FAIL. Add them to your .env file.');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

cloudinary.api
  .ping()
  .then((res) => console.log('✅ Cloudinary connected:', res.status))
  .catch((err) => console.error('❌ Cloudinary connection failed:', err.message));

module.exports = cloudinary;