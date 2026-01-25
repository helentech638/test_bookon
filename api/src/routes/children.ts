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
          parentId: userId,
          isActive: true
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
        medicalInfo: child.medicalInfo,
        emergencyContacts: child.emergencyContacts,
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
          parentId: userId,
          isActive: true
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
        medicalInfo: child.medicalInfo,
        emergencyContacts: child.emergencyContacts,
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
          dateOfBirth: new Date(dateOfBirth),
          isActive: true
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
          allergies: allergies,
          medicalInfo: medicalInfo,
          emergencyContacts: emergencyContacts,
          isActive: true
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

    // Check if child exists and belongs to user
    const existingChild = await db('children')
      .where('id', id)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!existingChild) {
      throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
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

    // Check if another child with same name and date of birth exists
    const duplicateChild = await db('children')
      .where('user_id', userId)
      .whereNot('id', id)
      .where('first_name', firstName)
      .where('last_name', lastName)
      .where('date_of_birth', dateOfBirth)
      .where('is_active', true)
      .first();

    if (duplicateChild) {
      throw new AppError('Another child with this name and date of birth already exists', 400, 'CHILD_ALREADY_EXISTS');
    }

    // Update child
    const [updatedChild] = await db('children')
      .where('id', id)
      .update({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        year_group: yearGroup,
        allergies,
        medical_info: medicalInfo,
        emergency_contacts: emergencyContacts,
        updated_at: new Date(),
      })
      .returning(['id', 'first_name', 'last_name']);

    logger.info('Child updated successfully', { 
      childId: id, 
      userId 
    });

    res.json({
      success: true,
      message: 'Child updated successfully',
      data: {
        id: updatedChild.id,
        firstName: updatedChild.first_name,
        lastName: updatedChild.last_name
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
    
    // Check if child exists and belongs to user
    const existingChild = await db('children')
      .where('id', id)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!existingChild) {
      throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
    }

    // Check if child has active bookings
    const activeBookings = await db('bookings')
      .where('child_id', id)
      .where('is_active', true)
      .first();

    if (activeBookings) {
      throw new AppError('Cannot delete child with active bookings', 400, 'CHILD_HAS_BOOKINGS');
    }

    // Soft delete - mark as inactive
    await db('children')
      .where('id', id)
      .update({
        is_active: false,
        updated_at: new Date(),
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
    
    // Check if child exists and belongs to user
    const existingChild = await db('children')
      .where('id', id)
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (!existingChild) {
      throw new AppError('Child not found', 404, 'CHILD_NOT_FOUND');
    }

    const bookings = await db('bookings')
      .select(
        'bookings.*',
        'activities.title as activity_title',
        'activities.start_date',
        'activities.start_time',
        'venues.name as venue_name'
      )
      .join('activities', 'bookings.activity_id', 'activities.id')
      .join('venues', 'activities.venue_id', 'venues.id')
      .where('bookings.child_id', id)
      .where('bookings.user_id', userId)
      .orderBy('bookings.created_at', 'desc');

    res.json({
      success: true,
      data: bookings.map(booking => ({
        id: booking.id,
        activity: {
          title: booking.activity_title,
          startDate: booking.start_date,
          startTime: booking.start_time
        },
        venue: {
          name: booking.venue_name
        },
        status: booking.status,
        totalAmount: parseFloat(booking.total_amount),
        notes: booking.notes,
        createdAt: booking.created_at
      }))
    });
  } catch (error) {
    logger.error('Error fetching child bookings:', error);
    throw new AppError('Failed to fetch child bookings', 500, 'CHILD_BOOKINGS_FETCH_ERROR');
  }
}));

export default router;
