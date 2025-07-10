// src/config/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorios si no existen
const createDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configuración para noticias
const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/news';
    createDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'news-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuración para avatares
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/avatars';
    createDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuración para Excel
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/temp';
    createDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'excel-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtros de archivos
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
};

const excelFilter = (req, file, cb) => {
  const allowedTypes = /xlsx|xls/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos Excel (xlsx, xls)'));
  }
};

// Exportar configuraciones
module.exports = {
  uploadNews: multer({
    storage: newsStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: imageFilter
  }),
  
  uploadAvatar: multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: imageFilter
  }),
  
  uploadExcel: multer({
    storage: excelStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: excelFilter
  })
};