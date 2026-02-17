// @ts-nocheck
import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

// Role-based permission middleware
const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: Function) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'FORBIDDEN'
      });
    }
    next();
  };
};

const router = Router();

// Get all courses
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { search, type, years, status, venueId } = req.query;
    const userId = req.user!.id;
    
    logger.info('Courses requested', { 
      user: req.user?.email,
      search,
      type,
      years,
      status,
      venueId,
      userId 
    });

    const courses = await safePrismaQuery(async (client) => {
      const where: any = {
        createdBy: userId,
        ...(status ? { status } : {})
      };

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      if (type) {
        where.type = type;
      }

      if (years) {
        where.years = years;
      }

      if (venueId) {
        where.venueId = venueId;
      }

      return await client.course.findMany({
        where,
        include: {
          template: {
            select: {
              name: true,
              type: true,
              years: true
            }
          },
          venue: {
            select: {
              name: true,
              address: true,
              city: true
            }
          },
          creator: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: {
              sessions: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    });

    logger.info('Courses retrieved', { 
      count: courses.length 
    });

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    logger.error('Error fetching courses:', error);
    throw error;
  }
}));

// Get single course
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    logger.info('Course requested', { 
      user: req.user?.email,
      courseId: id,
      userId 
    });

    const course = await safePrismaQuery(async (client) => {
      return await client.course.findFirst({
        where: {
          id: id,
          createdBy: userId
        },
        include: {
          template: true,
          venue: true,
          creator: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          sessions: {
            orderBy: {
              date: 'asc'
            }
          }
        }
      });
    });

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    logger.info('Course retrieved', { 
      courseId: id 
    });

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('Error fetching course:', error);
    throw error;
  }
}));

// Create course (from template or manual) - Admin and Coordinator
router.post('/', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      templateId,
      venueIds, // Array of venue IDs for multi-venue courses
      name,
      type,
      years,
      price,
      capacity,
      startDate,
      endDate,
      weekday,
      time,
      extras,
      description
    } = req.body;
    
    logger.info('Creating course', { 
      user: req.user?.email,
      templateId,
      venueIds,
      name,
      userId 
    });

    const courses = await safePrismaQuery(async (client) => {
      const courses = [];
      
      // Create one course per venue
      for (const venueId of venueIds) {
        const course = await client.course.create({
          data: {
            templateId: templateId || null,
            venueId: venueId,
            name,
            type,
            years,
            price: parseFloat(price),
            capacity: parseInt(capacity),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            weekday: weekday || null,
            time: time || null,
            extras: extras || null,
            createdBy: userId
          },
          include: {
            template: {
              select: {
                name: true,
                type: true,
                years: true
              }
            },
            venue: {
              select: {
                name: true,
                address: true,
                city: true
              }
            }
          }
        });
        courses.push(course);
      }

      return courses;
    });

    logger.info('Courses created', { 
      count: courses.length 
    });

    res.status(201).json({
      success: true,
      data: courses
    });
  } catch (error) {
    logger.error('Error creating course:', error);
    throw error;
  }
}));

// Preview sessions for a course
router.post('/:id/sessions/preview', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { excludeBankHolidays = true, excludeDates = [] } = req.body;
    
    logger.info('Generating session preview', { 
      user: req.user?.email,
      courseId: id,
      userId 
    });

    const course = await safePrismaQuery(async (client) => {
      return await client.course.findFirst({
        where: {
          id: id,
          createdBy: userId
        }
      });
    });

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    // Generate session dates based on course schedule
    const sessions = generateSessionDates(course, excludeBankHolidays, excludeDates);

    logger.info('Session preview generated', { 
      courseId: id,
      sessionCount: sessions.length 
    });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Error generating session preview:', error);
    throw error;
  }
}));

// Publish course and create sessions - Admin and Coordinator
router.post('/:id/publish', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { sessions } = req.body; // Array of session data
    
    logger.info('Publishing course', { 
      user: req.user?.email,
      courseId: id,
      sessionCount: sessions?.length || 0,
      userId 
    });

    const result = await safePrismaQuery(async (client) => {
      // Update course status to published
      const course = await client.course.update({
        where: {
          id: id,
          createdBy: userId
        },
        data: {
          status: 'published'
        }
      });

      // Create sessions
      const createdSessions = [];
      for (const sessionData of sessions) {
        const session = await client.session.create({
          data: {
            courseId: id,
            date: new Date(sessionData.date),
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            status: 'scheduled'
          }
        });
        createdSessions.push(session);
      }

      return {
        course,
        sessions: createdSessions
      };
    });

    logger.info('Course published', { 
      courseId: id,
      sessionCount: result.sessions.length 
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error publishing course:', error);
    throw error;
  }
}));

// Update course - Admin and Coordinator
router.put('/:id', authenticateToken, requireRole(['admin', 'coordinator']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const updateData = req.body;
    
    logger.info('Updating course', { 
      user: req.user?.email,
      courseId: id,
      userId 
    });

    const course = await safePrismaQuery(async (client) => {
      // Check if course exists and belongs to user
      const existingCourse = await client.course.findFirst({
        where: {
          id: id,
          createdBy: userId
        }
      });

      if (!existingCourse) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return await client.course.update({
        where: { id: id },
        data: {
          ...updateData,
          updatedAt: new Date()
        },
        include: {
          template: {
            select: {
              name: true,
              type: true,
              years: true
            }
          },
          venue: {
            select: {
              name: true,
              address: true,
              city: true
            }
          }
        }
      });
    });

    logger.info('Course updated', { 
      courseId: id 
    });

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('Error updating course:', error);
    throw error;
  }
}));

// Archive course - Admin only
router.patch('/:id/archive', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    logger.info('Archiving course', { 
      user: req.user?.email,
      courseId: id,
      userId 
    });

    const course = await safePrismaQuery(async (client) => {
      return await client.course.update({
        where: {
          id: id,
          createdBy: userId
        },
        data: {
          status: 'archived',
          updatedAt: new Date()
        }
      });
    });

    logger.info('Course archived', { 
      courseId: id 
    });

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    logger.error('Error archiving course:', error);
    throw error;
  }
}));

// Helper function to generate session dates
function generateSessionDates(course: any, excludeBankHolidays: boolean, excludeDates: string[]) {
  const sessions = [];
  const startDate = new Date(course.startDate);
  const endDate = new Date(course.endDate);
  
  // Simple implementation - generate sessions based on weekday
  if (course.weekday && course.time) {
    const [startTime, endTime] = course.time.split('-');
    const dayOfWeek = getDayOfWeekNumber(course.weekday);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (currentDate.getDay() === dayOfWeek) {
        // Check if date should be excluded
        const dateString = currentDate.toISOString().split('T')[0];
        if (!excludeDates.includes(dateString)) {
          // TODO: Add bank holiday checking logic
          sessions.push({
            date: dateString,
            startTime: startTime,
            endTime: endTime,
            status: 'scheduled'
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  return sessions;
}

function getDayOfWeekNumber(weekday: string): number {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days.indexOf(weekday.toLowerCase());
}

export default router;

