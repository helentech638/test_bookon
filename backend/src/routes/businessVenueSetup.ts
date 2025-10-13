import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get venue setups for business
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, status, page = 1, limit = 20 } = req.query;
  
  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Build where clause
    const where: any = { ownerId: userId };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { city: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (status) {
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }
    }

    // Get venue setups with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [venueSetups, totalCount] = await safePrismaQuery(async (client) => {
      // Try with businessAccount relation first, fallback to simple query if it fails
      let venues;
      try {
        venues = await client.venue.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            businessAccount: {
              select: {
                id: true,
                name: true,
                stripeAccountId: true
              }
            }
          }
        });
      } catch (relationError) {
        venues = await client.venue.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        });
      }
      
      const count = await client.venue.count({ where });
      return [venues, count];
    });

    res.status(200).json({
      success: true,
      data: {
        venueSetups,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching venue setups:', error);
    throw error;
  }
}));

// Create new venue setup
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const {
    name,
    address,
    city,
    postcode,
    phone,
    email,
    capacity,
    facilities,
    operatingHours,
    pricing,
    bookingRules,
    businessAccountId
  } = req.body;

  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Validate required fields
    if (!name || !address || !city || !postcode) {
      throw new AppError('Missing required fields', 400, 'MISSING_FIELDS');
    }

    // Create venue setup
    const venueSetup = await safePrismaQuery(async (client) => {
      return await client.venue.create({
        data: {
          name,
          address,
          city,
          postcode,
          phone: phone || null,
          email: email || null,
          capacity: capacity ? Number(capacity) : null,
          facilities: facilities || [],
          operatingHours: operatingHours || null,
          pricing: pricing || null,
          bookingRules: bookingRules || null,
          businessAccountId: businessAccountId || null,
          ownerId: userId,
          isActive: true
        },
        include: {
          businessAccount: {
            select: {
              id: true,
              name: true,
              stripeAccountId: true
            }
          }
        }
      });
    });

    logger.info('Venue setup created', { venueSetupId: venueSetup.id, userId });

    res.status(201).json({
      success: true,
      message: 'Venue setup created successfully',
      data: venueSetup
    });

  } catch (error) {
    logger.error('Error creating venue setup:', error);
    throw error;
  }
}));

// Update venue setup
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const updateData = req.body;

  logger.info('Venue update request received', { 
    venueId: id, 
    userId, 
    updateData: JSON.stringify(updateData, null, 2) 
  });

  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Check if venue setup exists and belongs to user
    const existingVenue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: { id, ownerId: userId }
      });
    });

    if (!existingVenue) {
      throw new AppError('Venue setup not found', 404, 'VENUE_SETUP_NOT_FOUND');
    }

    // Sanitize update data - remove undefined values but keep null and empty strings for optional fields
    const sanitizedData: any = {};
    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      if (value !== undefined) {
        // Handle businessAccountId specifically - convert empty string to null
        if (key === 'businessAccountId' && value === '') {
          sanitizedData[key] = null;
        } else {
          sanitizedData[key] = value;
        }
      }
    });

    // Ensure required fields are present and valid
    if (sanitizedData.name !== undefined && (!sanitizedData.name || sanitizedData.name.trim() === '')) {
      throw new AppError('Venue name is required', 400, 'INVALID_VENUE_NAME');
    }
    if (sanitizedData.address !== undefined && (!sanitizedData.address || sanitizedData.address.trim() === '')) {
      throw new AppError('Venue address is required', 400, 'INVALID_VENUE_ADDRESS');
    }
    if (sanitizedData.city !== undefined && (!sanitizedData.city || sanitizedData.city.trim() === '')) {
      throw new AppError('Venue city is required', 400, 'INVALID_VENUE_CITY');
    }
    if (sanitizedData.postcode !== undefined && (!sanitizedData.postcode || sanitizedData.postcode.trim() === '')) {
      throw new AppError('Venue postcode is required', 400, 'INVALID_VENUE_POSTCODE');
    }

    // Update venue setup
    logger.info('Attempting to update venue', { venueId: id, sanitizedData });
    
    const updatedVenue = await safePrismaQuery(async (client) => {
      return await client.venue.update({
        where: { id },
        data: {
          ...sanitizedData,
          updatedAt: new Date()
        },
        include: {
          businessAccount: {
            select: {
              id: true,
              name: true,
              stripeAccountId: true
            }
          }
        }
      });
    });

    logger.info('Venue updated successfully', { venueId: id });

    logger.info('Venue setup updated', { venueSetupId: id, userId });

    res.status(200).json({
      success: true,
      message: 'Venue setup updated successfully',
      data: updatedVenue
    });

  } catch (error) {
    logger.error('Error updating venue setup:', error);
    throw error;
  }
}));

// Delete venue setup
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Check if venue setup exists and belongs to user
    const existingVenue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: { id, ownerId: userId }
      });
    });

    if (!existingVenue) {
      throw new AppError('Venue setup not found', 404, 'VENUE_SETUP_NOT_FOUND');
    }

    // Check if venue has any activities
    const activityCount = await safePrismaQuery(async (client) => {
      return await client.activity.count({
        where: { venueId: id }
      });
    });

    if (activityCount > 0) {
      throw new AppError('Cannot delete venue setup with existing activities', 400, 'VENUE_HAS_ACTIVITIES');
    }

    // Delete venue setup
    await safePrismaQuery(async (client) => {
      return await client.venue.delete({
        where: { id }
      });
    });

    logger.info('Venue setup deleted', { venueSetupId: id, userId });

    res.status(200).json({
      success: true,
      message: 'Venue setup deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting venue setup:', error);
    throw error;
  }
}));

// Get venue setup by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    // Check if user has business access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || (!userInfo.businessName && userInfo.role !== 'business' && userInfo.role !== 'admin')) {
      throw new AppError('Business access required', 403, 'BUSINESS_ACCESS_REQUIRED');
    }

    // Get venue setup
    const venueSetup = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: { id, ownerId: userId },
        include: {
          businessAccount: {
            select: {
              id: true,
              name: true,
              stripeAccountId: true
            }
          }
        }
      });
    });

    if (!venueSetup) {
      throw new AppError('Venue setup not found', 404, 'VENUE_SETUP_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: venueSetup
    });

  } catch (error) {
    logger.error('Error fetching venue setup:', error);
    throw error;
  }
}));

export default router;
