const multer = require('multer');

const storage = multer.memoryStorage();

const excelMimes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];

const excelExts = /\.(xlsx|xls|csv)$/i;

const fileFilter = (req, file, cb) => {
  const okExt = excelExts.test(file.originalname);
  const okMime = excelMimes.includes(file.mimetype) ||
    file.mimetype.includes('spreadsheet') ||
    file.mimetype.includes('excel');

  if (okExt && okMime) return cb(null, true);
  return cb(new Error('يُسمح برفع ملفات Excel فقط (.xlsx, .xls, .csv)'));
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

const uploadExcel = upload.single('excel');

module.exports = { uploadExcel };