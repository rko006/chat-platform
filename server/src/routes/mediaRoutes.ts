import { Router, Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

// ─── S3 Configuration ────────────────────────────────────────────────────────
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
  // For local development with MinIO
  ...(process.env.AWS_ENDPOINT && {
    endpoint: process.env.AWS_ENDPOINT,
    forcePathStyle: true,
  }),
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'chat-platform-media';
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;

// ─── Multer Memory Storage ───────────────────────────────────────────────────
const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
  file: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
  ],
};

const ALL_ALLOWED = Object.values(ALLOWED_TYPES).flat();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALL_ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

function getMediaType(mimetype: string): string {
  for (const [type, mimes] of Object.entries(ALLOWED_TYPES)) {
    if (mimes.includes(mimetype)) return type;
  }
  return 'file';
}

function getS3Key(userId: string, filename: string, mediaType: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const ext = path.extname(filename).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;
  return `${mediaType}s/${userId}/${year}/${month}/${uniqueName}`;
}

// ─── Upload endpoint ─────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const userId = req.userId!;
    const { originalname, mimetype, buffer, size } = req.file;
    const mediaType = getMediaType(mimetype);
    const key = getS3Key(userId, originalname, mediaType);

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      Metadata: {
        userId,
        originalName: encodeURIComponent(originalname),
        uploadedAt: new Date().toISOString(),
      },
    }));

    const baseUrl = CLOUDFRONT_URL || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    const mediaUrl = `${baseUrl}/${key}`;

    logger.info(`File uploaded: ${key} (${size} bytes) by user ${userId}`);

    res.json({
      mediaUrl,
      mediaType,
      mediaSize: size,
      mediaName: originalname,
      mimeType: mimetype,
    });
  } catch (error: any) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ─── Delete media ─────────────────────────────────────────────────────────────
router.delete('/delete', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mediaUrl } = req.body;
    if (!mediaUrl) {
      res.status(400).json({ error: 'Media URL required' });
      return;
    }

    // Extract key from URL
    const urlObj = new URL(mediaUrl);
    const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

    // Verify ownership: key starts with mediaType/userId/...
    const parts = key.split('/');
    if (parts.length < 2 || parts[1] !== req.userId) {
      res.status(403).json({ error: 'Not authorized to delete this file' });
      return;
    }

    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 50MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes('not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Upload failed' });
});

export default router;
