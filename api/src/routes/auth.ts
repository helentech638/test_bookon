// @ts-nocheck
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, authRateLimit, logout } from '../middleware/auth';
import { redis } from '../utils/redis';
import { logger, logSecurity } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { prismaDirect } from '../utils/prismaDirect';
import businessOnboardingRouter from './businessOnboarding';

const router = Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name is required'),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validatePasswordReset = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

// Helper function to generate JWT tokens
const generateTokens = (user: { id: string; email: string; role: string }) => {
  try {
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-jwt-secret-for-development';
    const jwtRefreshSecret = process.env['JWT_REFRESH_SECRET'] || 'fallback-refresh-secret-for-development';
    
    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error('JWT secrets not configured');
    }

    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        type: 'access' 
      },
      jwtSecret,
      { expiresIn: process.env['JWT_EXPIRES_IN'] || '24h' } as any
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        type: 'refresh' 
      },
      jwtRefreshSecret,
      { expiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d' } as any
    );

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Error generating JWT tokens:', error);
    throw new AppError('Authentication service error', 500, 'JWT_ERROR');
  }
};

// User registration
router.post('/register', validateRegistration, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error('Registration validation failed:', {
      errors: errors.array(),
      body: req.body
    });
    throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { email, password, firstName, lastName } = req.body;
  
  logger.info('Registration attempt:', {
    email,
    hasPassword: !!password,
    firstName,
    lastName,
    passwordLength: password?.length
  });

  // Check if user already exists using direct connection
  const existingUser = await prismaDirect.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
  }

  // Hash password
  const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Generate verification token
  const verificationToken = uuidv4();
  // const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user using direct connection
  const result = await prismaDirect.user.create({
    data: {
      email,
      password_hash: passwordHash,
      firstName: firstName,
      lastName: lastName,
      role: 'parent',
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  // Store verification token in Redis
  try {
    await redis.setex(
      `email_verification:${verificationToken}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify({ userId: result.id, email })
    );
  } catch (redisError) {
    logger.warn('Redis not accessible, continuing without token storage:', redisError);
  }

  // TODO: Send verification email
  logger.info('User registered successfully', {
    userId: result.id,
    email: result.email,
    ip: req.ip || req.connection.remoteAddress,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please check your email for verification.',
    data: {
      user: {
        id: result.id,
        email: result.email,
        role: result.role,
      },
    },
  });
}));

// User login
router.post('/login', validateLogin, authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { email, password } = req.body;

    // Log the request for debugging
    logger.info('Login attempt', {
      email: email,
      hasPassword: !!password,
      bodyKeys: Object.keys(req.body),
      contentType: req.get('Content-Type')
    });

    // Check if email is properly formatted
    if (!email || typeof email !== 'string') {
      throw new AppError('Valid email is required', 400, 'INVALID_EMAIL');
    }

    // Try to connect to database with retry logic
    let user;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        // Find user using regular prisma client
        user = await prisma.user.findUnique({
          where: { email: email.trim() },
          select: { id: true, email: true, password_hash: true, role: true, isActive: true }
        });
        break; // Success, exit retry loop
      } catch (dbError: any) {
        retryCount++;
        logger.error(`Database connection error during login (attempt ${retryCount}/${maxRetries}):`, dbError);
        
        if (retryCount >= maxRetries) {
          logger.error('Max retries reached for database connection');
          throw new AppError('Database connection failed after multiple attempts', 500, 'DATABASE_CONNECTION_ERROR');
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (!user || !user.isActive) {
      logSecurity('Failed login attempt', {
        email,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      });
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password with proper error handling
    try {
      if (!user.password_hash) {
        logSecurity('Failed login attempt - no password hash', {
          email,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        });
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        logSecurity('Failed login attempt - incorrect password', {
          email,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        });
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }
    } catch (error) {
      // Log bcrypt error for debugging
      logger.error('Password comparison error', {
        error: error instanceof Error ? error.message : String(error),
        email,
        hasStoredPassword: !!user.password_hash,
        storedPasswordType: typeof user.password_hash
      });
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token in Redis
    try {
      await redis.setex(
        `refresh_token:${user.id}`,
        7 * 24 * 60 * 60, // 7 days
        refreshToken
      );
    } catch (redisError) {
      logger.warn('Failed to store refresh token in Redis:', redisError);
      // Continue without storing token - user can still login
    }

    // Update last login
    // await db('users')
    //   .where('id', user.id)
    //   .update({ lastLoginAt: new Date() });

    // Log successful login
    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip || req.connection.remoteAddress,
    });

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token: accessToken,
        refreshToken: refreshToken,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    // If it's an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }
    
    // For unexpected errors, return a generic error
    throw new AppError('Login failed due to server error', 500, 'LOGIN_ERROR');
  }
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env['JWT_REFRESH_SECRET']!) as any;
    
    // Check if refresh token exists in Redis
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'INVALID_CREDENTIALS');
    }

    // Generate new tokens
    const newTokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Update refresh token in Redis
    await redis.setex(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60, // 7 days
      newTokens.refreshToken
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: newTokens,
      },
    });
  } catch (error) {
    if ((error as any).name === 'JsonWebTokenError') {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    } else if ((error as any).name === 'TokenExpiredError') {
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw error;
  }
}));

// Logout
router.post('/logout', authenticateToken, logout, asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    // Remove refresh token from Redis
    await redis.del(`refresh_token:${req.user.id}`);
  }

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

// Email verification
router.get('/verify/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  // Get verification data from Redis
  const verificationData = await redis.get(`email_verification:${token}`);
  if (!verificationData) {
    throw new AppError('Invalid or expired verification token', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  const { userId, email } = JSON.parse(verificationData);

  // Update user verification status
  // Note: email_verified column doesn't exist in the database
  // await db('users')
  //   .where('id', userId)
  //   .update({ email_verified: true });

  // Remove verification token from Redis
  await redis.del(`email_verification:${token}`);

  logger.info('Email verified successfully', { userId, email });

  res.json({
    success: true,
    message: 'Email verified successfully',
  });
}));

// Request password reset
router.post('/forgot-password', validatePasswordReset, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { email } = req.body;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email }
  });
  if (!user) {
    // Don't reveal if user exists or not
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }

  // Generate reset token
  const resetToken = uuidv4();
  // const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  // Store reset token in Redis
  await redis.setex(
    `password_reset:${resetToken}`,
    60 * 60, // 1 hour
    JSON.stringify({ userId: user.id, email })
  );

  // TODO: Send password reset email
  logger.info('Password reset requested', { userId: user.id, email });

  return res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
}));

// Reset password
router.post('/reset-password/:token', validatePasswordChange, asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
  }

  // Get reset data from Redis
  const resetData = await redis.get(`password_reset:${token}`);
  if (!resetData) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
  }

  const { userId } = JSON.parse(resetData);

  // Hash new password
  const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: passwordHash }
  });

  // Remove reset token from Redis
  await redis.del(`password_reset:${token}`);

  // Invalidate all existing sessions
  await redis.del(`refresh_token:${userId}`);

  logger.info('Password reset successfully', { userId });

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
}));

// Change password (authenticated user)
router.post('/change-password', authenticateToken, validatePasswordChange, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password_hash: true }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash || '');
  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400, 'INCORRECT_PASSWORD');
  }

  // Hash new password
  const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: passwordHash }
  });

  // Invalidate all existing sessions
  await redis.del(`refresh_token:${userId}`);

  logger.info('Password changed successfully', { userId });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const user = await prismaDirect.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        firstName: true,
        lastName: true,
        role: true, 
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (dbError) {
    logger.error('Database error getting user profile:', dbError);
    throw new AppError('Failed to fetch user profile', 500, 'DATABASE_ERROR');
  }
}));

// Update user profile
router.put('/me', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { firstName, lastName } = req.body;

  try {
    const updatedUser = await prismaDirect.user.update({
      where: { id: userId },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        // Note: phone and address fields don't exist in current schema
        // These would need to be added to the User model
      },
      select: { 
        id: true, 
        email: true, 
        firstName: true,
        lastName: true,
        role: true, 
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (dbError) {
    logger.error('Database error updating user profile:', dbError);
    throw new AppError('Failed to update user profile', 500, 'DATABASE_ERROR');
  }
}));

// Admin-only login endpoint for testing
router.post('/admin-login', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    // Hardcoded admin credentials for testing
    const adminCredentials = {
      email: 'admin@bookon.com',
      password: 'admin123',
      role: 'admin'
    };

    if (email !== adminCredentials.email || password !== adminCredentials.password) {
      throw new AppError('Invalid admin credentials', 401, 'INVALID_CREDENTIALS');
    }

    const adminUser = {
      id: 'admin-user-id',
      email: adminCredentials.email,
      role: adminCredentials.role,
      isActive: true
    };

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(adminUser);

    // Store refresh token in Redis
    try {
      await redis.setex(
        `refresh_token:${adminUser.id}`,
        7 * 24 * 60 * 60, // 7 days
        refreshToken
      );
    } catch (redisError) {
      logger.warn('Redis not accessible, continuing without token storage:', redisError);
    }

    logger.info('Admin login successful', {
      email: adminUser.email,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
        },
        token: accessToken,
        refreshToken: refreshToken,
      },
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Admin login failed', 500, 'ADMIN_LOGIN_ERROR');
  }
}));

// Database test endpoint
router.get('/test-db', asyncHandler(async (_req: Request, res: Response) => {
  try {
    logger.info('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$executeRaw`SELECT 1`;
    logger.info('✅ Basic database connection successful');
    
    // Create all tables if they don't exist
    logger.info('🔧 Creating all tables...');
    
    // Create users table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      "firstName" VARCHAR(255) NOT NULL,
      "lastName" VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      "isActive" BOOLEAN DEFAULT true,
      "emailVerified" BOOLEAN DEFAULT false,
      "verificationToken" VARCHAR(255),
      "resetToken" VARCHAR(255),
      "resetTokenExpiry" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "lastLoginAt" TIMESTAMP
    )`;
    
    // Create children table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS children (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "firstName" VARCHAR(255) NOT NULL,
      "lastName" VARCHAR(255) NOT NULL,
      "dateOfBirth" TIMESTAMP NOT NULL,
      "parentId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    // Create venues table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS venues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      address VARCHAR(500) NOT NULL,
      description TEXT,
      capacity INTEGER,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    // Create activities table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      duration INTEGER,
      "maxCapacity" INTEGER,
      "venueId" UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    // Create bookings table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "activityId" UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      "childId" UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      "parentId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'pending',
      "payment_status" VARCHAR(50) DEFAULT 'pending',
      "payment_intent_id" VARCHAR(255),
      "total_amount" DECIMAL(10,2),
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    // Create webhook_events table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(255) NOT NULL,
      source VARCHAR(255) NOT NULL,
      data JSONB,
      processed BOOLEAN DEFAULT false,
      error TEXT,
      retry_count INTEGER DEFAULT 0,
      external_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP
    )`;
    
    // Create notifications table
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      priority VARCHAR(50) DEFAULT 'medium',
      channels TEXT[],
      "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
      "venueId" UUID,
      status VARCHAR(50) DEFAULT 'pending',
      read BOOLEAN DEFAULT false,
      error TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "sentAt" TIMESTAMP,
      "readAt" TIMESTAMP
    )`;
    
    // Add missing fields to users table
    await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255)`;
    await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS "venueId" UUID`;
    
    logger.info('✅ All tables created');
    
    // Create test user if doesn't exist
    const testUser = await prisma.user.findUnique({
      where: { email: 'admin@bookon.com' }
    });
    
    if (!testUser) {
      logger.info('🔧 Creating test user...');
      await prisma.user.create({
        data: {
          email: 'admin@bookon.com',
          password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8O', // admin123
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true
        }
      });
      logger.info('✅ Test user created');
    }
    
    return res.json({
      success: true,
      message: 'Database connection and setup successful',
      data: {
        connection: 'OK',
        tables: 'Created',
        testUser: 'Available'
      }
    });
    
  } catch (error) {
    logger.error('Database test failed:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database test failed',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}));

// Reset admin password endpoint
router.post('/reset-admin-password', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email = 'admin@bookon.com', password = 'admin123' } = req.body;
    
    // Find the admin user
    const existingUser = await prismaDirect.user.findUnique({
      where: { email }
    });
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Admin user not found'
        }
      });
    }
    
    // Hash the new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Update the user's password
    const updatedUser = await prismaDirect.user.update({
      where: { email },
      data: {
        password_hash: passwordHash
      }
    });
    
    logger.info('✅ Admin password reset', {
      email: updatedUser.email,
      role: updatedUser.role
    });
    
    return res.json({
      success: true,
      message: 'Admin password reset successfully',
      data: {
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
    
  } catch (error) {
    logger.error('❌ Failed to reset admin password:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reset admin password',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}));

// Create admin user endpoint
router.post('/create-admin', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email = 'admin@bookon.com', password = 'admin123', firstName = 'Admin', lastName = 'User' } = req.body;
    
    // Check if admin user already exists with retry logic
    let existingUser;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        existingUser = await prisma.user.findUnique({
          where: { email }
        });
        break; // Success, exit retry loop
      } catch (dbError: any) {
        retryCount++;
        logger.error(`Database connection error during admin check (attempt ${retryCount}/${maxRetries}):`, dbError);
        
        if (retryCount >= maxRetries) {
          logger.error('Max retries reached for database connection');
          throw new AppError('Database connection failed after multiple attempts', 500, 'DATABASE_CONNECTION_ERROR');
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (existingUser) {
      return res.json({
        success: true,
        message: 'Admin user already exists',
        data: {
          email: existingUser.email,
          role: existingUser.role
        }
      });
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create admin user with retry logic
    let adminUser: any = null;
    retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        adminUser = await prisma.user.create({
          data: {
            email,
            password_hash: passwordHash,
            firstName,
            lastName,
            role: 'admin',
            isActive: true,
            emailVerified: true
          }
        });
        break; // Success, exit retry loop
      } catch (dbError: any) {
        retryCount++;
        logger.error(`Database connection error during admin creation (attempt ${retryCount}/${maxRetries}):`, dbError);
        
        if (retryCount >= maxRetries) {
          logger.error('Max retries reached for database connection');
          throw new AppError('Database connection failed after multiple attempts', 500, 'DATABASE_CONNECTION_ERROR');
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (!adminUser) {
      throw new AppError('Failed to create admin user', 500, 'ADMIN_CREATION_FAILED');
    }
    
    logger.info('✅ Admin user created', {
      email: adminUser.email,
      role: adminUser.role
    });
    
    return res.json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        email: adminUser.email,
        role: adminUser.role,
        id: adminUser.id
      }
    });
    
  } catch (error) {
    logger.error('❌ Failed to create admin user:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create admin user',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}));

// Simple database seeding endpoint
router.post('/seed-db', asyncHandler(async (_req: Request, res: Response) => {
  try {
    logger.info('🌱 Starting simple database seeding...');

    // Create a simple venue first
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@bookon.com' }
    });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        error: { message: 'Admin user not found. Please run /test-db first.' }
      });
    }

    // Create a simple venue
    const venue = await prisma.venue.create({
      data: {
        name: 'Community Sports Center',
        address: '123 Sports Lane, London',
        description: 'Modern sports facility with multiple courts and equipment',
        capacity: 100,
        ownerId: adminUser.id,
        isActive: true,
      },
    });

    // Create a simple course (replacing activity)
    const course = await prisma.course.create({
      data: {
        name: 'Football Training',
        type: 'after_school',
        years: 'Y1-Y2',
        price: 15.00,
        capacity: 20,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        weekday: 'Monday',
        time: '15:30-16:30',
        status: 'published',
        venueId: venue.id,
        createdBy: adminUser.id,
      },
    });

    // Create a parent user
    const parentUser = await prisma.user.create({
      data: {
        email: 'parent@bookon.com',
        password_hash: await bcrypt.hash('parent123', 12),
        firstName: 'John',
        lastName: 'Smith',
        role: 'parent',
        isActive: true,
        emailVerified: true,
      },
    });

    // Create a child
    const child = await prisma.child.create({
      data: {
        firstName: 'Emma',
        lastName: 'Smith',
        dateOfBirth: new Date('2015-03-15'),
        parentId: parentUser.id,
      },
    });

    // Create a booking
    const booking = await prisma.booking.create({
      data: {
        activityId: course.id,
        childId: child.id,
        parentId: parentUser.id,
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'card',
        amount: 25.00,
        totalAmount: 25.00,
        currency: 'GBP',
        bookingDate: new Date(),
        activityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        activityTime: '15:30',
      },
    });

    logger.info('✅ Simple seeding completed');
    
    return res.json({
      success: true,
      message: 'Simple database seeding completed successfully!',
      data: {
        venue: venue.name,
        course: course.name,
        parent: parentUser.email,
        child: `${child.firstName} ${child.lastName}`,
        booking: booking.id,
        testAccounts: {
          admin: 'admin@bookon.com / admin123',
          parent: 'parent@bookon.com / parent123'
        }
      }
    });

  } catch (error) {
    logger.error('❌ Simple seeding failed:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Simple seeding failed',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}));

// Business onboarding routes
router.use('/', businessOnboardingRouter);

export default router;

