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

// Configuración para logos de clubs
const clubStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/clubs';
    createDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'club-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuración para documentos generales
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/documents';
    createDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuración para banners
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/banners';
    createDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
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

const documentFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|txt|rtf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf'
  ];
  
  if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && 
      mimetypes.includes(file.mimetype)) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten documentos (pdf, doc, docx, txt, rtf)'));
  }
};

const allFilesFilter = (req, file, cb) => {
  // Permitir cualquier tipo de archivo (usar con precaución)
  cb(null, true);
};

// Exportar configuraciones
module.exports = {
  // Configuraciones específicas por tipo
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
  }),

  uploadClubLogo: multer({
    storage: clubStorage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: imageFilter
  }),

  uploadDocument: multer({
    storage: documentStorage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: documentFilter
  }),

  uploadBanner: multer({
    storage: bannerStorage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: imageFilter
  }),

  // Configuración flexible para múltiples tipos
  uploadMultiple: multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        let uploadPath = 'uploads/general';
        
        // Determinar carpeta según el tipo de archivo
        if (imageFilter(req, file, () => {})) {
          uploadPath = 'uploads/images';
        } else if (documentFilter(req, file, () => {})) {
          uploadPath = 'uploads/documents';
        } else if (excelFilter(req, file, () => {})) {
          uploadPath = 'uploads/temp';
        }
        
        createDir(uploadPath);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = req.body.fileType || 'file';
        cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: allFilesFilter
  }),

  // Configuración para archivos temporales
  uploadTemp: multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/temp';
        createDir(uploadPath);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'temp-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: allFilesFilter
  }),

  // Configuración personalizable
  createUploader: (options = {}) => {
    const {
      destination = 'uploads/custom',
      filePrefix = 'custom',
      maxSize = 10 * 1024 * 1024, // 10MB por defecto
      allowedTypes = ['jpeg', 'jpg', 'png'],
      allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png']
    } = options;

    const customFilter = (req, file, cb) => {
      const extname = allowedTypes.some(type => 
        new RegExp(type, 'i').test(path.extname(file.originalname).toLowerCase())
      );
      const mimetype = allowedMimeTypes.includes(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error(`Solo se permiten archivos: ${allowedTypes.join(', ')}`));
      }
    };

    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          createDir(destination);
          cb(null, destination);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${filePrefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
      }),
      limits: { fileSize: maxSize },
      fileFilter: customFilter
    });
  },

  // Utilidades
  createDir,
  
  // Filtros exportados para uso externo
  filters: {
    imageFilter,
    excelFilter,
    documentFilter,
    allFilesFilter
  },

  // Configuraciones de límites
  limits: {
    avatar: 2 * 1024 * 1024,      // 2MB
    news: 5 * 1024 * 1024,        // 5MB
    club: 3 * 1024 * 1024,        // 3MB
    excel: 10 * 1024 * 1024,      // 10MB
    document: 15 * 1024 * 1024,   // 15MB
    banner: 8 * 1024 * 1024,      // 8MB
    general: 20 * 1024 * 1024,    // 20MB
    temp: 50 * 1024 * 1024        // 50MB
  },

  // Tipos de archivo permitidos
  allowedTypes: {
    images: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
    documents: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    spreadsheets: ['xlsx', 'xls'],
    all: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'rtf', 'xlsx', 'xls']
  }
};