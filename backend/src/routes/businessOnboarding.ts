import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware for business onboarding
const validateBusinessOnboarding = [
  body('businessName').notEmpty().withMessage('Business name is required'),
  body('businessType').notEmpty().withMessage('Business type is required'),
  body('businessPhone').notEmpty().withMessage('Business phone is required'),
  body('businessEmail').isEmail().withMessage('Valid business email is required'),
  body('businessAddress').notEmpty().withMessage('Business address is required'),
  body('businessCity').notEmpty().withMessage('Business city is required'),
  body('businessPostcode').notEmpty().withMessage('Business postcode is required'),
  body('websiteUrl').optional().isURL().withMessage('Website URL must be valid'),
];

// Complete business onboarding
router.post('/business-onboarding', authenticateToken, validateBusinessOnboarding, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error('Business onboarding validation failed:', {
      errors: errors.array(),
      body: req.body
    });
    throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
  }

  const userId = req.user!.id;
  const {
    businessName,
    tradingName,
    companyRegistrationNumber,
    businessType,
    businessDescription,
    websiteUrl,
    businessPhone,
    businessEmail,
    businessAddress,
    businessCity,
    businessPostcode,
    businessCountry
  } = req.body;

  logger.info('Business onboarding request:', {
    userId,
    businessName,
    businessType,
    hasTradingName: !!tradingName,
    hasRegistrationNumber: !!companyRegistrationNumber,
    hasWebsite: !!websiteUrl
  });

  try {
    // Check if user exists and is a business user
    const user = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          role: true, 
          businessName: true,
          onboardingCompleted: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== 'business') {
      throw new AppError('Only business users can complete business onboarding', 403, 'INVALID_ROLE');
    }

    if (user.onboardingCompleted) {
      throw new AppError('Business onboarding already completed', 400, 'ONBOARDING_COMPLETED');
    }

    // Update user with business profile information
    const updatedUser = await safePrismaQuery(async (client) => {
      return await client.user.update({
        where: { id: userId },
        data: {
          businessName: businessName || user.businessName,
          tradingName: tradingName || null,
          companyRegistrationNumber: companyRegistrationNumber || null,
          businessType: businessType || null,
          businessDescription: businessDescription || null,
          websiteUrl: websiteUrl || null,
          businessPhone: businessPhone || null,
          businessEmail: businessEmail || null,
          businessAddress: businessAddress || null,
          businessCity: businessCity || null,
          businessPostcode: businessPostcode || null,
          businessCountry: businessCountry || 'United Kingdom',
          onboardingCompleted: true,
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessName: true,
          tradingName: true,
          businessType: true,
          businessPhone: true,
          businessEmail: true,
          businessAddress: true,
          businessCity: true,
          businessPostcode: true,
          businessCountry: true,
          onboardingCompleted: true
        }
      });
    });

    logger.info('Business onboarding completed successfully:', {
      userId: updatedUser.id,
      businessName: updatedUser.businessName,
      onboardingCompleted: updatedUser.onboardingCompleted
    });

    res.json({
      success: true,
      message: 'Business onboarding completed successfully',
      data: {
        user: updatedUser,
        onboardingCompleted: true
      }
    });

  } catch (error) {
    logger.error('Error completing business onboarding:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to complete business onboarding', 500, 'ONBOARDING_ERROR');
  }
}));

// Get business profile
router.get('/business-profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const user = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          businessName: true,
          tradingName: true,
          companyRegistrationNumber: true,
          businessType: true,
          businessDescription: true,
          websiteUrl: true,
          businessPhone: true,
          businessEmail: true,
          businessAddress: true,
          businessCity: true,
          businessPostcode: true,
          businessCountry: true,
          onboardingCompleted: true,
          createdAt: true,
          updatedAt: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== 'business') {
      throw new AppError('Only business users can access business profile', 403, 'INVALID_ROLE');
    }

    res.json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    logger.error('Error fetching business profile:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch business profile', 500, 'PROFILE_FETCH_ERROR');
  }
}));

// Update business profile
router.put('/business-profile', authenticateToken, validateBusinessOnboarding, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error('Business profile update validation failed:', {
      errors: errors.array(),
      body: req.body
    });
    throw new AppError(errors.array()[0]?.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
  }

  const userId = req.user!.id;
  const {
    businessName,
    tradingName,
    companyRegistrationNumber,
    businessType,
    businessDescription,
    websiteUrl,
    businessPhone,
    businessEmail,
    businessAddress,
    businessCity,
    businessPostcode,
    businessCountry
  } = req.body;

  try {
    // Check if user exists and is a business user
    const user = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          role: true,
          onboardingCompleted: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== 'business') {
      throw new AppError('Only business users can update business profile', 403, 'INVALID_ROLE');
    }

    // Update user with business profile information
    const updatedUser = await safePrismaQuery(async (client) => {
      return await client.user.update({
        where: { id: userId },
        data: {
          businessName: businessName || null,
          tradingName: tradingName || null,
          companyRegistrationNumber: companyRegistrationNumber || null,
          businessType: businessType || null,
          businessDescription: businessDescription || null,
          websiteUrl: websiteUrl || null,
          businessPhone: businessPhone || null,
          businessEmail: businessEmail || null,
          businessAddress: businessAddress || null,
          businessCity: businessCity || null,
          businessPostcode: businessPostcode || null,
          businessCountry: businessCountry || 'United Kingdom',
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          businessName: true,
          tradingName: true,
          businessType: true,
          businessPhone: true,
          businessEmail: true,
          businessAddress: true,
          businessCity: true,
          businessPostcode: true,
          businessCountry: true,
          onboardingCompleted: true
        }
      });
    });

    logger.info('Business profile updated successfully:', {
      userId: updatedUser.id,
      businessName: updatedUser.businessName
    });

    res.json({
      success: true,
      message: 'Business profile updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    logger.error('Error updating business profile:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update business profile', 500, 'PROFILE_UPDATE_ERROR');
  }
}));

export default router;

