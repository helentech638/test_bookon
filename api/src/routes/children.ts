import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { body, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateChild = [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
  body('dateOfBirth').isISO8601().withMessage('Date of birth must be a valid date'),
  body('yearGroup').optional().trim().isLength({ max: 20 }).withMessage('Year group too long'),
  body('allergies').optional().trim().isLength({ max: 500 }).withMessage('Allergies description too long'),
  body('medicalInfo').optional().trim().isLength({ max: 1000 }).withMessage('Medical info too long'),
];

// Get all children for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const children = await safePrismaQuery(async (client) => {
      return await client.child.findMany({
        where: {
          parentId: userId
        },
        orderBy: {
          firstName: 'asc'
        }
      });
    });

    res.json({
      success: true,
      data: children.map(child => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        yearGroup: child.yearGroup,
        allergies: child.allergies,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching children:', error);
    throw new AppError('Failed to fetch children', 500, 'CHILDREN_FETCH_ERROR');
  }
}));

// Get single child by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const child = await safePrismaQuery(async (client) => {
      return await client.child.findFirst({
        where: {
          id: id,
          parentId: userId
        }
      });
    });

    if (!child) {
      throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        yearGroup: child.yearGroup,
        allergies: child.allergies,

        createdAt: child.createdAt,
        updatedAt: child.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching child:', error);
    throw new AppError('Failed to fetch child', 500, 'CHILD_FETCH_ERROR');
  }
}));

// Create new child
router.post('/', authenticateToken, validateChild, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const {
      firstName,
      lastName,
      dateOfBirth,
      yearGroup,
      allergies,
      medicalInfo,
      emergencyContacts
    } = req.body;

    // Check if child with same name and date of birth already exists for this user
    const existingChild = await safePrismaQuery(async (client) => {
      return await client.child.findFirst({
        where: {
          parentId: userId,
          firstName: firstName,
          lastName: lastName,
          dateOfBirth: new Date(dateOfBirth)
        }
      });
    });

    if (existingChild) {
      throw new AppError('Child with this name and date of birth already exists', 400, 'CHILD_ALREADY_EXISTS');
    }

    const child = await safePrismaQuery(async (client) => {
      return await client.child.create({
        data: {
          parentId: userId,
          firstName: firstName,
          lastName: lastName,
          dateOfBirth: new Date(dateOfBirth),
          yearGroup: yearGroup,
          allergies: allergies
        },
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      });
    });

    logger.info('Child created successfully', {
      childId: child.id,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Child created successfully',
      data: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName
      }
    });
  } catch (error) {
    logger.error('Error creating child:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create child', 500, 'CHILD_CREATE_ERROR');
  }
}));

// Update child
router.put('/:id', authenticateToken, validateChild, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const {
      firstName,
      lastName,
      dateOfBirth,
      yearGroup,
      allergies
    } = req.body;

    const updatedChild = await safePrismaQuery(async (client) => {
      // Check if child exists and belongs to user
      const existingChild = await client.child.findFirst({
        where: {
          id: id,
          parentId: userId
        }
      });

      if (!existingChild) {
        throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
      }

      // Check for duplicate
      const duplicateChild = await client.child.findFirst({
        where: {
          parentId: userId,
          firstName: firstName,
          lastName: lastName,
          dateOfBirth: new Date(dateOfBirth),
          NOT: {
            id: id
          }
        }
      });

      if (duplicateChild) {
        throw new AppError('Another child with this name and date of birth already exists', 400, 'CHILD_ALREADY_EXISTS');
      }

      return await client.child.update({
        where: { id },
        data: {
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          yearGroup,
          allergies
        }
      });
    });

    logger.info('Child updated successfully', {
      childId: id,
      userId
    });

    res.json({
      success: true,
      message: 'Child updated successfully',
      data: {
        id: updatedChild.id,
        firstName: updatedChild.firstName,
        lastName: updatedChild.lastName
      }
    });
  } catch (error) {
    logger.error('Error updating child:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update child', 500, 'CHILD_UPDATE_ERROR');
  }
}));

// Delete child
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await safePrismaQuery(async (client) => {
      // Check if child exists and belongs to user
      const existingChild = await client.child.findFirst({
        where: {
          id: id,
          parentId: userId
        }
      });

      if (!existingChild) {
        throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
      }

      // Check if child has active bookings
      const activeBookings = await client.booking.findFirst({
        where: {
          childId: id,
          status: { in: ['pending', 'confirmed'] }
        }
      });

      if (activeBookings) {
        throw new AppError('Cannot delete child with active bookings', 400, 'CHILD_HAS_BOOKINGS');
      }

      // Connect to delete
      await client.child.delete({
        where: { id }
      });
    });

    logger.info('Child deleted successfully', {
      childId: id,
      userId
    });

    res.json({
      success: true,
      message: 'Child deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting child:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete child', 500, 'CHILD_DELETE_ERROR');
  }
}));

// Get child's booking history
router.get('/:id/bookings', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const bookings = await safePrismaQuery(async (client) => {
      // Check if child exists and belongs to user
      const existingChild = await client.child.findFirst({
        where: {
          id: id,
          parentId: userId
        }
      });

      if (!existingChild) {
        throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
      }

      return await client.booking.findMany({
        where: {
          childId: id,
          parentId: userId
        },
        include: {
          activity: {
            include: {
              venue: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    });

    res.json({
      success: true,
      data: bookings.map(booking => ({
        id: booking.id,
        activity: {
          title: booking.activity.title,
          startDate: booking.activity.startDate,
          startTime: booking.activity.startTime
        },
        venue: {
          name: booking.activity.venue.name
        },
        status: booking.status,
        totalAmount: Number(booking.amount),
        notes: booking.notes,
        createdAt: booking.createdAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching child bookings:', error);
    throw new AppError('Failed to fetch child bookings', 500, 'CHILD_BOOKINGS_FETCH_ERROR');
  }
}));

export default router;
