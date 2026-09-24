const express = require('express');
const router = express.Router();
const {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  getMe,
  updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', loginUser);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;