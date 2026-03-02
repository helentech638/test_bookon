import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get business venues
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

    // Get venues with pagination
    const skip = (Number(page) - 1) * Number(limit);

    const [venues, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.venue.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            address: true,
            description: true,
            city: true,
            postcode: true,
            phone: true,
            email: true,
            capacity: true,
            facilities: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                activities: true
              }
            }
          }
        }),
        client.venue.count({ where })
      ]);
    });

    res.json({
      success: true,
      data: {
        venues,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching business venues:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch venues', 500, 'VENUES_FETCH_ERROR');
  }
}));

// Get single venue
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

    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: {
          id,
          ownerId: userId
        },
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          city: true,
          postcode: true,
          phone: true,
          email: true,
          capacity: true,
          facilities: true,
          isActive: true,
          tfcEnabled: true,
          tfcHoldPeriod: true,
          tfcInstructions: true,
          tfcDefaultToCredit: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              activities: true
            }
          }
        }
      });
    });

    if (!venue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: venue
    });

  } catch (error) {
    logger.error('Error fetching venue details:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch venue details', 500, 'VENUE_FETCH_ERROR');
  }
}));

// Create venue
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const {
    name,
    address,
    description,
    city,
    postcode,
    phone,
    email,
    capacity,
    facilities,
    tfcEnabled = true,
    tfcHoldPeriod = 5,
    tfcInstructions,
    tfcDefaultToCredit = true
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
    if (!name || !address) {
      throw new AppError('Name and address are required', 400, 'VALIDATION_ERROR');
    }

    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.create({
        data: {
          name,
          address,
          description,
          city,
          postcode,
          phone,
          email,
          capacity: capacity ? parseInt(capacity) : null,
          facilities: facilities || [],
          ownerId: userId,
          tfcEnabled,
          tfcHoldPeriod,
          tfcInstructions,
          tfcDefaultToCredit,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          city: true,
          postcode: true,
          phone: true,
          email: true,
          capacity: true,
          facilities: true,
          isActive: true,
          tfcEnabled: true,
          tfcHoldPeriod: true,
          tfcInstructions: true,
          tfcDefaultToCredit: true,
          createdAt: true,
          updatedAt: true
        }
      });
    });

    res.status(201).json({
      success: true,
      data: venue
    });

  } catch (error) {
    logger.error('Error creating venue:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create venue', 500, 'VENUE_CREATE_ERROR');
  }
}));

// Update venue
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const {
    name,
    address,
    description,
    city,
    postcode,
    phone,
    email,
    capacity,
    facilities,
    tfcEnabled,
    tfcHoldPeriod,
    tfcInstructions,
    tfcDefaultToCredit,
    isActive
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

    // Check if venue exists and belongs to user
    const existingVenue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: {
          id,
          ownerId: userId
        }
      });
    });

    if (!existingVenue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (description !== undefined) updateData.description = description;
    if (city !== undefined) updateData.city = city;
    if (postcode !== undefined) updateData.postcode = postcode;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
    if (facilities !== undefined) updateData.facilities = facilities;
    if (tfcEnabled !== undefined) updateData.tfcEnabled = tfcEnabled;
    if (tfcHoldPeriod !== undefined) updateData.tfcHoldPeriod = tfcHoldPeriod;
    if (tfcInstructions !== undefined) updateData.tfcInstructions = tfcInstructions;
    if (tfcDefaultToCredit !== undefined) updateData.tfcDefaultToCredit = tfcDefaultToCredit;
    if (isActive !== undefined) updateData.isActive = isActive;

    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          city: true,
          postcode: true,
          phone: true,
          email: true,
          capacity: true,
          facilities: true,
          isActive: true,
          tfcEnabled: true,
          tfcHoldPeriod: true,
          tfcInstructions: true,
          tfcDefaultToCredit: true,
          createdAt: true,
          updatedAt: true
        }
      });
    });

    res.json({
      success: true,
      data: venue
    });

  } catch (error) {
    logger.error('Error updating venue:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update venue', 500, 'VENUE_UPDATE_ERROR');
  }
}));

// Delete venue
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

    // Check if venue exists and belongs to user
    const existingVenue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: {
          id,
          ownerId: userId
        }
      });
    });

    if (!existingVenue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    // DEBUG: Skip dependency check temporarily
    logger.info('DEBUG: Skipping dependency check for venue deletion', { venueId: id });

    /*
    const activeDependencies = await safePrismaQuery(async (client) => {
      const activities = await client.activity.count({
        where: { venueId: id, isActive: true }
      });
      const courses = await client.course.count({
        where: { venueId: id, status: { in: ['active', 'scheduled'] } }
      });
      return { activities, courses };
    });

    if (activeDependencies.activities > 0 || activeDependencies.courses > 0) {
      throw new AppError('Cannot delete venue with active activities or courses', 400, 'VENUE_HAS_DEPENDENCIES');
    }
    */

    // Soft delete - mark as inactive
    await safePrismaQuery(async (client) => {
      return await client.venue.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() }
      });
    });

    res.json({
      success: true,
      message: 'Venue deleted successfully'
    });

  } catch (error: any) {
    logger.error('Error deleting venue:', {
      error: error.message,
      stack: error.stack,
      venueId: id,
      userId
    });
    if (error instanceof AppError) throw error;
    // Temporarily use 400 to bypass production 500 masking in errorHandler.ts
    throw new AppError(`Failed to delete venue: ${error.message}`, 400, 'VENUE_DELETE_DEBUG');
  }
}));

// Toggle venue status
router.patch('/:id/toggle', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
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

    // Check if venue exists and belongs to user
    const existingVenue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: {
          id,
          ownerId: userId
        }
      });
    });

    if (!existingVenue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.update({
        where: { id },
        data: { isActive: !existingVenue.isActive },
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          city: true,
          postcode: true,
          phone: true,
          email: true,
          capacity: true,
          isActive: true,
          tfcEnabled: true,
          tfcHoldPeriod: true,
          tfcInstructions: true,
          tfcDefaultToCredit: true,
          createdAt: true,
          updatedAt: true
        }
      });
    });

    res.json({
      success: true,
      data: venue
    });

  } catch (error) {
    logger.error('Error toggling venue status:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to toggle venue status', 500, 'VENUE_TOGGLE_ERROR');
  }
}));

export default router;
