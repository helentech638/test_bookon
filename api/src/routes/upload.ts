import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter - only allow image types
const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|jfif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/jpeg';
    if (extname || mimetype) {
        return cb(null, true);
    }
    cb(null, false); // Silently reject, let route handle it
};

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter
});

// POST /api/v1/upload/image
router.post('/image', authenticateToken, (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            logger.error('Multer error during upload:', err);
            return res.status(400).json({
                success: false,
                error: { message: `Upload error: ${err.message}`, code: 'MULTER_ERROR' }
            });
        } else if (err) {
            logger.error('Unknown error during upload:', err);
            return res.status(500).json({
                success: false,
                error: { message: 'Failed to process upload', code: 'UPLOAD_ERROR' }
            });
        }
        next();
    });
}, (req: any, res: any) => {
    try {
        const file = req.file || (req.files && req.files[0]);

        if (!file) {
            return res.status(400).json({
                success: false,
                error: { message: 'No image uploaded', code: 'NO_IMAGE_UPLOADED' }
            });
        }

        const host = req.get('host');
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const imageUrl = `${protocol}://${host}/uploads/${file.filename}`;

        logger.info('Image uploaded successfully', { filename: file.filename, url: imageUrl });

        res.status(201).json({
            success: true,
            data: {
                url: imageUrl,
                filename: file.filename,
                mimetype: file.mimetype,
                size: file.size
            }
        });
    } catch (error) {
        logger.error('Error in image upload route:', error);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to upload image', code: 'SERVER_ERROR' }
        });
    }
});

export default router;
