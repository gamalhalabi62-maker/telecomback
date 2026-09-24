const express = require('express');
const router = express.Router();
const {
  searchMember,
  registerAttendance,
  getPublicStats,
  getAttendanceList,
  getAttendanceStats,
  exportAttendance,
  importMembersFromExcel,
  deleteAllMembers,
  resetAttendance,
  deleteAttendance,
} = require('../controllers/electionController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { uploadExcel } = require('../middleware/uploadExcel');

router.post('/search', searchMember);
router.post('/register', registerAttendance);
router.get('/public-stats', getPublicStats);

router.get('/admin/list', protect, adminOnly, getAttendanceList);
router.get('/admin/stats', protect, adminOnly, getAttendanceStats);
router.get('/admin/export', protect, adminOnly, exportAttendance);
router.post('/admin/import', protect, adminOnly, uploadExcel, importMembersFromExcel);
router.delete('/admin/members', protect, adminOnly, deleteAllMembers);
router.delete('/admin/attendance', protect, adminOnly, resetAttendance);
router.delete('/admin/attendance/:id', protect, adminOnly, deleteAttendance);

module.exports = router;