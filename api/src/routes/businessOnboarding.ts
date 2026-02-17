import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

type CachedBusinessProfile = {
  businessName?: string;
  tradingName?: string;
  companyRegistrationNumber?: string;
  businessType?: string;
  businessDescription?: string;
  websiteUrl?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessAddress?: string;
  businessCity?: string;
  businessPostcode?: string;
  businessCountry?: string;
  onboardingCompleted?: boolean;
};

// Compatibility cache for business profile fields that are not available in all DB schemas.
const businessProfileCache = new Map<string, CachedBusinessProfile>();

const emptyBusinessProfile: CachedBusinessProfile = {
  businessName: '',
  tradingName: '',
  companyRegistrationNumber: '',
  businessType: '',
  businessDescription: '',
  websiteUrl: '',
  businessPhone: '',
  businessEmail: '',
  businessAddress: '',
  businessCity: '',
  businessPostcode: '',
  businessCountry: 'United Kingdom',
  onboardingCompleted: true
};

const buildBusinessProfileResponse = (user: any, cached?: CachedBusinessProfile) => {
  const merged = { ...emptyBusinessProfile, ...(cached || {}) };

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    businessName: merged.businessName || '',
    tradingName: merged.tradingName || '',
    companyRegistrationNumber: merged.companyRegistrationNumber || '',
    businessType: merged.businessType || '',
    businessDescription: merged.businessDescription || '',
    websiteUrl: merged.websiteUrl || '',
    businessPhone: merged.businessPhone || '',
    businessEmail: merged.businessEmail || '',
    businessAddress: merged.businessAddress || '',
    businessCity: merged.businessCity || '',
    businessPostcode: merged.businessPostcode || '',
    businessCountry: merged.businessCountry || 'United Kingdom',
    onboardingCompleted: merged.onboardingCompleted !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

// Complete business onboarding
router.post('/business-onboarding', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const user = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          isActive: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== 'business' && user.role !== 'admin') {
      throw new AppError('Only business users can complete business onboarding', 403, 'INVALID_ROLE');
    }

    const cachedProfile: CachedBusinessProfile = {
      businessName: req.body.businessName || '',
      tradingName: req.body.tradingName || '',
      companyRegistrationNumber: req.body.companyRegistrationNumber || '',
      businessType: req.body.businessType || '',
      businessDescription: req.body.businessDescription || '',
      websiteUrl: req.body.websiteUrl || '',
      businessPhone: req.body.businessPhone || '',
      businessEmail: req.body.businessEmail || '',
      businessAddress: req.body.businessAddress || '',
      businessCity: req.body.businessCity || '',
      businessPostcode: req.body.businessPostcode || '',
      businessCountry: req.body.businessCountry || 'United Kingdom',
      onboardingCompleted: true
    };

    businessProfileCache.set(userId, cachedProfile);

    // Keep at least one persisted contact field updated in DB.
    if (cachedProfile.businessPhone && cachedProfile.businessPhone !== user.phone) {
      await safePrismaQuery(async (client) => {
        return await client.user.update({
          where: { id: userId },
          data: {
            phone: cachedProfile.businessPhone
          }
        });
      });
    }

    logger.info('Business onboarding completed (compat mode)', { userId });

    return res.json({
      success: true,
      message: 'Business onboarding completed successfully',
      data: {
        user: buildBusinessProfileResponse(user, cachedProfile),
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
          role: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          isActive: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== 'business' && user.role !== 'admin') {
      throw new AppError('Only business users can access business profile', 403, 'INVALID_ROLE');
    }

    const cachedProfile = businessProfileCache.get(userId);

    return res.json({
      success: true,
      data: {
        user: buildBusinessProfileResponse(user, cachedProfile)
      }
    });
  } catch (error) {
    logger.error('Error fetching business profile:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch business profile', 500, 'PROFILE_FETCH_ERROR');
  }
}));

// Update business profile
router.put('/business-profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const user = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          isActive: true
        }
      });
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role !== 'business' && user.role !== 'admin') {
      throw new AppError('Only business users can update business profile', 403, 'INVALID_ROLE');
    }

    const existing = businessProfileCache.get(userId) || {};
    const updatedProfile: CachedBusinessProfile = {
      ...existing,
      businessName: req.body.businessName ?? existing.businessName ?? '',
      tradingName: req.body.tradingName ?? existing.tradingName ?? '',
      companyRegistrationNumber: req.body.companyRegistrationNumber ?? existing.companyRegistrationNumber ?? '',
      businessType: req.body.businessType ?? existing.businessType ?? '',
      businessDescription: req.body.businessDescription ?? existing.businessDescription ?? '',
      websiteUrl: req.body.websiteUrl ?? existing.websiteUrl ?? '',
      businessPhone: req.body.businessPhone ?? existing.businessPhone ?? '',
      businessEmail: req.body.businessEmail ?? existing.businessEmail ?? '',
      businessAddress: req.body.businessAddress ?? existing.businessAddress ?? '',
      businessCity: req.body.businessCity ?? existing.businessCity ?? '',
      businessPostcode: req.body.businessPostcode ?? existing.businessPostcode ?? '',
      businessCountry: req.body.businessCountry ?? existing.businessCountry ?? 'United Kingdom',
      onboardingCompleted: true
    };

    businessProfileCache.set(userId, updatedProfile);

    if (updatedProfile.businessPhone && updatedProfile.businessPhone !== user.phone) {
      await safePrismaQuery(async (client) => {
        return await client.user.update({
          where: { id: userId },
          data: {
            phone: updatedProfile.businessPhone
          }
        });
      });
    }

    logger.info('Business profile updated (compat mode)', { userId });

    return res.json({
      success: true,
      message: 'Business profile updated successfully',
      data: {
        user: buildBusinessProfileResponse(user, updatedProfile)
      }
    });
  } catch (error) {
    logger.error('Error updating business profile:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update business profile', 500, 'PROFILE_UPDATE_ERROR');
  }
}));

export default router;
