import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (/^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(file.mimetype)) return cb(null, true);
  const err = new Error("Only image files (jpeg, png, webp, gif, avif) are allowed");
  err.statusCode = 400;
  cb(err);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const setUploadPrefix = (prefix) => (req, res, next) => {
  req.uploadPrefix = prefix;
  next();
};
