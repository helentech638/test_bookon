import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import { holidayService } from '../utils/holidayService';
import { calendarService } from '../utils/calendarService';

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
    return next();
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
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
    
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
      extras
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
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
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
    
    // Get suggested exclusions (bank holidays) for the course period
    const suggestedExclusions = holidayService.getSuggestedExclusions(
      new Date(course.startDate), 
      new Date(course.endDate)
    );

    logger.info('Session preview generated', { 
      courseId: id,
      sessionCount: sessions.length,
      suggestedExclusions: suggestedExclusions.length
    });

    res.json({
      success: true,
      data: {
        sessions,
        suggestedExclusions
      }
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
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
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

      // Create an activity for this course
      const activity = await client.activity.create({
        data: {
          name: course.name,
          description: `Course: ${course.name}`,
          venueId: course.venueId,
          ownerId: userId,
          createdBy: userId,
          type: course.type,
          years: course.years,
          price: course.price,
          capacity: course.capacity,
          startDate: course.startDate,
          endDate: course.endDate,
          status: 'published'
        }
      });

      // Create sessions for the activity
      const createdSessions = [];
      for (const sessionData of sessions) {
        const session = await client.session.create({
          data: {
            activityId: activity.id,
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
        activity,
        sessions: createdSessions
      };
    });

    logger.info('Course published', { 
      courseId: id,
      activityId: result.activity.id,
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
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
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
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
    
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

// Delete course - Admin only
router.delete('/:id', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
    
    logger.info('Deleting course', { 
      user: req.user?.email,
      courseId: id,
      userId 
    });

    // Check if course exists and belongs to user
    const existingCourse = await safePrismaQuery(async (client) => {
      return await client.course.findFirst({
        where: {
          id: id,
          createdBy: userId
        }
      });
    });

    if (!existingCourse) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    // Check if course has active sessions
    const activeSessions = await safePrismaQuery(async (client) => {
      return await client.session.findFirst({
        where: {
          courseId: id,
          status: 'active'
        }
      });
    });

    if (activeSessions) {
      throw new AppError('Cannot delete course with active sessions', 400, 'COURSE_HAS_SESSIONS');
    }

    // Delete the course
    await safePrismaQuery(async (client) => {
      return await client.course.delete({
        where: {
          id: id
        }
      });
    });

    logger.info('Course deleted', { 
      courseId: id 
    });

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting course:', error);
    throw error;
  }
}));

// Helper function to generate session dates
function generateSessionDates(course: any, excludeBankHolidays: boolean, excludeDates: string[]) {
  const sessions = [];
  const startDate = new Date(course.startDate);
  const endDate = new Date(course.endDate);
  
  // Generate sessions based on weekday
  if (course.weekday && course.time) {
    const [startTime, endTime] = course.time.split('-');
    const dayOfWeek = getDayOfWeekNumber(course.weekday);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (currentDate.getDay() === dayOfWeek) {
        // Check if date should be excluded using holiday service
        if (!holidayService.shouldExcludeDate(currentDate, excludeBankHolidays, excludeDates)) {
          sessions.push({
            date: currentDate.toISOString().split('T')[0],
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

// Export course calendar (iCal format)
router.get('/:id/calendar', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    if (!id) {
      throw new AppError('Course ID is required', 400, 'MISSING_COURSE_ID');
    }
    
    logger.info('Exporting course calendar', { 
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
          venue: true
        }
      });
    });

    if (!course) {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    // Find the associated activity and its sessions
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          name: course.name,
          venueId: course.venueId,
          createdBy: userId
        },
        include: {
          sessions: {
            orderBy: {
              date: 'asc'
            }
          },
          venue: true
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found for this course', 404, 'ACTIVITY_NOT_FOUND');
    }

    const calendarContent = calendarService.generateCourseCalendar(activity);
    const filename = calendarService.getCalendarFilename(`${course.name.toLowerCase().replace(/\s+/g, '-')}`);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(calendarContent);

    logger.info('Course calendar exported', { 
      courseId: id,
      filename 
    });
  } catch (error) {
    logger.error('Error exporting course calendar:', error);
    throw error;
  }
}));

// Get bank holidays for a date range
router.get('/holidays/:year', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { year } = req.params;
    const yearNumber = parseInt(year);
    
    if (!year || isNaN(yearNumber) || yearNumber < 2020 || yearNumber > 2030) {
      throw new AppError('Invalid year', 400, 'INVALID_YEAR');
    }

    const holidays = holidayService.getBankHolidays(yearNumber);

    res.json({
      success: true,
      data: holidays
    });
  } catch (error) {
    logger.error('Error fetching bank holidays:', error);
    throw error;
  }
}));

// Get suggested exclusions for a date range
router.post('/suggested-exclusions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    const suggestedExclusions = holidayService.getSuggestedExclusions(
      new Date(startDate), 
      new Date(endDate)
    );

    res.json({
      success: true,
      data: suggestedExclusions
    });
  } catch (error) {
    logger.error('Error getting suggested exclusions:', error);
    throw error;
  }
}));

function getDayOfWeekNumber(weekday: string): number {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days.indexOf(weekday.toLowerCase());
}

export default router;
