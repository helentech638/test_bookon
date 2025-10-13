import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { uploadImageToSupabase } from '../utils/supabase';

const router = express.Router();

// CORS middleware for upload routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Configure multer for memory storage (for Vercel serverless)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
  }
});

// Upload single image
router.post('/image', authenticateToken, upload.single('image'), asyncHandler(async (req: any, res: any) => {
  try {
    logger.info('Image upload request received', {
      userId: req.user?.id,
      hasFile: !!req.file,
      headers: req.headers
    });

    if (!req.file) {
      throw new AppError('No image file provided', 400, 'NO_FILE');
    }

    // Upload to Supabase Storage
    const { url, path } = await uploadImageToSupabase(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user.id
    );
    
    logger.info('Image uploaded successfully to Supabase', {
      userId: req.user.id,
      fileName: req.file.originalname,
      size: req.file.size,
      url,
      path
    });

    res.json({
      success: true,
      data: {
        url: url,
        path: path,
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    logger.error('Image upload error:', error);
    throw new AppError('Failed to upload image', 500, 'UPLOAD_ERROR');
  }
}));

// Upload multiple images
router.post('/images', authenticateToken, upload.array('images', 10), asyncHandler(async (req: any, res: any) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new AppError('No image files provided', 400, 'NO_FILES');
    }

    const uploadedImages = await Promise.all(
      req.files.map(async (file: any) => {
        const { url, path } = await uploadImageToSupabase(
          file.buffer,
          file.originalname,
          file.mimetype,
          req.user.id
        );
        
        return {
          url: url,
          path: path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size
        };
      })
    );
    
    logger.info('Multiple images uploaded successfully to Supabase', {
      userId: req.user.id,
      count: req.files.length,
      paths: uploadedImages.map(img => img.path)
    });

    res.json({
      success: true,
      data: {
        images: uploadedImages
      }
    });
  } catch (error) {
    logger.error('Multiple images upload error:', error);
    throw new AppError('Failed to upload images', 500, 'UPLOAD_ERROR');
  }
}));

// Delete image
router.delete('/image/:path', authenticateToken, asyncHandler(async (req: any, res: any) => {
  try {
    const { path } = req.params;
    const decodedPath = decodeURIComponent(path);
    
    const { deleteImageFromSupabase } = await import('../utils/supabase');
    await deleteImageFromSupabase(decodedPath);
    
    logger.info('Image deleted successfully from Supabase', {
      userId: req.user.id,
      path: decodedPath
    });
    
    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    logger.error('Image deletion error:', error);
    throw new AppError('Failed to delete image', 500, 'DELETE_ERROR');
  }
}));

export default router;
