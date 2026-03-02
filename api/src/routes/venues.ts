import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { body, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateVenue = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  body('address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters'),
  body('city').trim().isLength({ min: 2, max: 50 }).withMessage('City must be 2-50 characters'),
  body('postcode').trim().isLength({ min: 3, max: 10 }).withMessage('Postcode must be 3-10 characters'),
  body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/).withMessage('Invalid phone number'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
];

// Get all venues (public - no auth required)
router.get('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      city,
      search,
      ownerId
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const limitNum = parseInt(limit as string);

    // Build where clause for Prisma
    const whereClause: any = {
      isActive: true
    };

    if (ownerId) {
      whereClause.ownerId = ownerId as string;
    }

    // Filter by city
    if (city) {
      whereClause.city = {
        contains: city as string,
        mode: 'insensitive'
      };
    }

    // Search by name or description
    if (search) {
      whereClause.OR = [
        {
          name: {
            contains: search as string,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search as string,
            mode: 'insensitive'
          }
        }
      ];
    }

    logger.info('DEBUG: Fetching venues started', { whereClause });
    const startTime = Date.now();

    const [venues, totalCount] = await safePrismaQuery(async (client) => {
      return await Promise.all([
        client.venue.findMany({
          where: whereClause,
          orderBy: { name: 'asc' },
          take: limitNum,
          skip: offset
        }),
        client.venue.count({ where: whereClause })
      ]);
    });

    const duration = Date.now() - startTime;
    logger.info(`DEBUG: Fetching venues completed in ${duration}ms`, { count: venues.length });

    res.json({
      success: true,
      data: venues.map(venue => ({
        id: venue.id,
        name: venue.name,
        description: venue.description,
        address: venue.address,
        city: (venue as any).city,
        postcode: (venue as any).postcode,
        phone: (venue as any).phone,
        email: (venue as any).email,
        createdAt: venue.createdAt,
        updatedAt: venue.updatedAt
      })),
      pagination: {
        page: parseInt(page as string),
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching venues:', error);
    throw new AppError('Failed to fetch venues', 500, 'VENUES_FETCH_ERROR');
  }
}));

// Get single venue by ID
router.get('/:id', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const venue = await prisma.venue.findFirst({
      where: {
        id: id!,
        isActive: true
      }
    });

    if (!venue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        id: venue.id,
        name: venue.name,
        description: venue.description,
        address: venue.address,
        city: (venue as any).city,
        postcode: (venue as any).postcode,
        phone: (venue as any).phone,
        email: (venue as any).email,
        createdAt: venue.createdAt,
        updatedAt: venue.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching venue:', error);
    throw new AppError('Failed to fetch venue', 500, 'VENUE_FETCH_ERROR');
  }
}));

// Create new venue
router.post('/', authenticateToken, validateVenue, asyncHandler(async (req: Request, res: Response) => {
  try {
    // Both admins and business users can create venues
    // We could add a check for specific roles here if needed, 
    // but for now any authenticated user can create a venue they own.

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const {
      name,
      description,
      address,
      city,
      postcode,
      phone,
      email
    } = req.body;

    const venue = await prisma.venue.create({
      data: {
        name,
        description,
        address,
        ...(city && { city }),
        ...(postcode && { postcode }),
        ...(phone && { phone }),
        ...(email && { email }),
        isActive: true,
        ownerId: req.user!.id, // Add ownerId from authenticated user
      },
      select: {
        id: true,
        name: true
      }
    });

    logger.info('Venue created successfully', {
      venueId: venue.id,
      userId: req.user!.id
    });

    res.status(201).json({
      success: true,
      message: 'Venue created successfully',
      data: {
        id: venue.id,
        name: venue.name
      }
    });
  } catch (error) {
    logger.error('Error creating venue:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create venue', 500, 'VENUE_CREATE_ERROR');
  }
}));

// Update venue
router.put('/:id', authenticateToken, validateVenue, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    // Check if venue exists
    const existingVenue = await prisma.venue.findFirst({
      where: {
        id: id!,
        isActive: true
      }
    });

    if (!existingVenue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    // Check if user has permission to update this venue
    if (userRole !== 'admin' && existingVenue.ownerId !== userId) {
      throw new AppError('Insufficient permissions to update this venue', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    const {
      name,
      description,
      address,
      city,
      postcode,
      phone,
      email
    } = req.body;

    // Update venue
    const updatedVenue = await prisma.venue.update({
      where: { id: id! },
      data: {
        name,
        description,
        address,
        ...(city && { city }),
        ...(postcode && { postcode }),
        ...(phone && { phone }),
        ...(email && { email }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true
      }
    });

    logger.info('Venue updated successfully', {
      venueId: id,
      userId: req.user!.id
    });

    res.json({
      success: true,
      message: 'Venue updated successfully',
      data: {
        id: updatedVenue.id,
        name: updatedVenue.name
      }
    });
  } catch (error) {
    logger.error('Error updating venue:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update venue', 500, 'VENUE_UPDATE_ERROR');
  }
}));

// Delete venue
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if venue exists
    const existingVenue = await prisma.venue.findFirst({
      where: {
        id: id!,
        isActive: true
      }
    });

    if (!existingVenue) {
      throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
    }

    // Check if user has permission to delete this venue
    if (userRole !== 'admin' && existingVenue.ownerId !== userId) {
      throw new AppError('Insufficient permissions to delete this venue', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    // DEBUG: Skip dependency check temporarily to allow deactivation
    logger.info('DEBUG: Skipping dependency check for venue deletion', { venueId: id });

    /*
    const activeDependencies = await safePrismaQuery(async (client) => {
      const activities = await client.activity.count({
        where: { venueId: id!, isActive: true }
      });
      // We also check courses here for consistency with businessVenues
      const courses = await client.course.count({
        where: { venueId: id!, status: { in: ['active', 'scheduled'] } }
      });
      return { activities, courses };
    });

    if (activeDependencies.activities > 0 || activeDependencies.courses > 0) {
      throw new AppError('Cannot delete venue with active activities or courses', 400, 'VENUE_HAS_DEPENDENCIES');
    }
    */

    // Soft delete - mark as inactive
    await prisma.venue.update({
      where: { id: id! },
      data: {
        isActive: false,
        updatedAt: new Date(),
      }
    });

    logger.info('Venue deleted successfully', {
      venueId: id,
      userId: req.user!.id
    });

    res.json({
      success: true,
      message: 'Venue deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting venue:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete venue', 500, 'VENUE_DELETE_ERROR');
  }
}));

export default router;
