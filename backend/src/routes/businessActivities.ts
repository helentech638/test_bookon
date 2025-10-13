import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get business activities
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, type, venue, status, page = 1, limit = 20 } = req.query;
  
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

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Build where clause
    const where: any = {
      venueId: { in: venueIds }
    };

    if (search) {
      where.title = { contains: search as string, mode: 'insensitive' };
    }

    if (type) {
      where.type = type;
    }

    if (venue) {
      where.venueId = venue;
    }

    if (status) {
      where.status = status;
    }

    // Get activities with pagination
    const activities = await safePrismaQuery(async (client) => {
      return await client.activity.findMany({
        where,
        include: {
          venue: {
            select: { id: true, name: true, address: true }
          },
          bookings: {
            where: { 
              status: { 
                in: ['confirmed', 'pending'] 
              } 
            },
            select: { id: true }
          }
        } as any,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      });
    });

    // Get total count for pagination
    const totalCount = await safePrismaQuery(async (client) => {
      return await client.activity.count({ where });
    });

    // Format response
    const formattedActivities = activities.map((activity: any) => ({
      id: activity.id,
      name: activity.title,
      type: activity.type || 'After-School',
      venue: activity.venue?.name || 'Unknown Venue',
      venueId: activity.venue?.id,
      time: `${activity.startTime || '09:00'} - ${activity.endTime || '17:00'}`,
      capacity: activity.capacity || 20,
      booked: activity.bookings?.length || 0,
      status: activity.status || 'active',
      nextSession: activity.startDate.toISOString().split('T')[0],
      description: activity.description,
      price: activity.price,
      // Course/Program specific fields
      durationWeeks: activity.durationWeeks,
      regularDay: activity.regularDay,
      regularTime: activity.regularTime,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt
    }));

    logger.info('Business activities fetched successfully', { 
      userId, 
      count: formattedActivities.length,
      totalCount 
    });

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        },
        venues: venues
      }
    });

  } catch (error) {
    logger.error('Error fetching business activities:', error);
    throw new AppError('Failed to fetch activities', 500, 'ACTIVITIES_ERROR');
  }
}));

// Get single activity
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activityId = req.params['id'];
  
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

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Get activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId || '',
          venueId: { in: venueIds }
        },
        include: {
          venue: {
            select: { id: true, name: true, address: true }
          },
          bookings: {
            include: {
              child: {
                select: { firstName: true, lastName: true }
              },
              parent: {
                select: { firstName: true, lastName: true, email: true }
              }
            }
          },
          holidayTimeSlots: true,
          sessionBlocks: true,
          _count: {
            select: {
              bookings: {
                where: { status: 'confirmed' }
              }
            }
          }
        }
      });
    });

    if (!activity) {
      throw new AppError('Activity not found', 404, 'ACTIVITY_NOT_FOUND');
    }

    logger.info('Business activity fetched successfully', { userId, activityId });

    res.json({
      success: true,
      data: {
        id: activity.id,
        title: activity.title,
        type: activity.type || 'After-School',
        description: activity.description,
        startDate: activity.startDate,
        endDate: activity.endDate,
        startTime: activity.startTime,
        endTime: activity.endTime,
        price: activity.price,
        capacity: activity.capacity || 20,
        booked: (activity as any).bookings?.length || 0,
        status: activity.status || 'active',
        venue: (activity as any).venue,
        // Holiday Club fields
        ageRange: activity.ageRange,
        whatToBring: activity.whatToBring,
        earlyDropoff: activity.earlyDropoff,
        earlyDropoffPrice: activity.earlyDropoffPrice,
        latePickup: activity.latePickup,
        latePickupPrice: activity.latePickupPrice,
        excludeDates: activity.excludeDates,
        siblingDiscount: activity.siblingDiscount,
        bulkDiscount: activity.bulkDiscount,
        weeklyDiscount: activity.weeklyDiscount,
        holidayTimeSlots: (activity as any).holidayTimeSlots,
        // Wraparound Care fields
        isWraparoundCare: activity.isWraparoundCare,
        yearGroups: activity.yearGroups,
        sessionBlocks: (activity as any).sessionBlocks,
        // Other fields
        daysOfWeek: activity.daysOfWeek,
        proRataBooking: activity.proRataBooking,
        holidaySessions: activity.holidaySessions,
        bookings: (activity as any).bookings.map((booking: any) => ({
          id: booking.id,
          childName: `${booking.child.firstName} ${booking.child.lastName}`,
          parentName: `${booking.parent.firstName} ${booking.parent.lastName}`,
          parentEmail: booking.parent.email,
          status: booking.status,
          createdAt: booking.createdAt
        })),
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error fetching business activity:', error);
    throw new AppError('Failed to fetch activity', 500, 'ACTIVITY_ERROR');
  }
}));

// Create new activity
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, title, type, venueId, startDate, endDate, startTime, endTime, capacity, price, description, imageUrls, sessionBlocks, yearGroups, ageRange, whatToBring, earlyDropoff, earlyDropoffPrice, earlyDropoffStartTime, earlyDropoffEndTime, latePickup, latePickupPrice, latePickupStartTime, latePickupEndTime, excludeDates, siblingDiscount, bulkDiscount, weeklyDiscount, customTimeSlots, daysOfWeek, durationWeeks, regularDay, regularTime, courseExcludeDates } = req.body;
  
  logger.info('Creating business activity', {
    userId,
    name,
    title,
    type,
    venueId,
    hasSessionBlocks: !!sessionBlocks,
    sessionBlocksCount: sessionBlocks?.length || 0
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

    // Verify venue belongs to user
    const venue = await safePrismaQuery(async (client) => {
      return await client.venue.findFirst({
        where: {
          id: venueId,
          ownerId: userId
        }
      });
    });

    if (!venue) {
      throw new AppError('Venue not found or access denied', 404, 'VENUE_NOT_FOUND');
    }

    // Get the activity name from either 'name' or 'title' field
    const activityName = name || title;
    
    // Validate required fields
    if (!activityName || !activityName.trim()) {
      throw new AppError('Activity name is required', 400, 'MISSING_ACTIVITY_NAME');
    }

    // Validate pricing for wraparound care
    if (type === 'wraparound_care') {
      if ((!price || price <= 0) && (!sessionBlocks || sessionBlocks.length === 0)) {
        throw new AppError('Wraparound care activities must have either a base price or session block prices', 400, 'INVALID_PRICING');
      }
    }

    // Validate Holiday Club specific fields
    if (type === 'holiday_club') {
      if (!ageRange || ageRange.trim() === '') {
        throw new AppError('Age range is required for holiday club activities', 400, 'MISSING_AGE_RANGE');
      }
      if (price <= 0) {
        throw new AppError('Valid price is required for holiday club activities', 400, 'INVALID_HOLIDAY_CLUB_PRICING');
      }
    }

    // Create activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.create({
        data: {
          title: activityName,
          type: type || 'After-School',
          description: description || '',
          imageUrls: imageUrls || [],
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          startTime: startTime && startTime.trim() !== '' ? startTime : '09:00',
          endTime: endTime && endTime.trim() !== '' ? endTime : '17:00',
          capacity: capacity || 20,
          price: price || 0,
          venueId: venueId,
          status: 'active',
          isActive: true,
          ownerId: userId,
          createdBy: userId,
          // Holiday Club fields
          ageRange: ageRange || null,
          whatToBring: whatToBring || null,
          earlyDropoff: earlyDropoff || false,
          earlyDropoffPrice: earlyDropoffPrice || null,
          earlyDropoffStartTime: earlyDropoffStartTime || null,
          earlyDropoffEndTime: earlyDropoffEndTime || null,
          latePickup: latePickup || false,
          latePickupPrice: latePickupPrice || null,
          latePickupStartTime: latePickupStartTime || null,
          latePickupEndTime: latePickupEndTime || null,
          excludeDates: excludeDates || [],
          siblingDiscount: siblingDiscount || null,
          bulkDiscount: bulkDiscount || null,
          weeklyDiscount: weeklyDiscount || null,
          // Wraparound Care fields
          isWraparoundCare: type === 'wraparound_care' || false,
          yearGroups: yearGroups || [],
          // Course/Program specific fields
          daysOfWeek: daysOfWeek || [],
          durationWeeks: durationWeeks || null,
          regularDay: regularDay || null,
          regularTime: regularTime || null,
          courseExcludeDates: courseExcludeDates || []
        },
        include: {
          venue: {
            select: { id: true, name: true }
          }
        }
      });
    });

    // Create session blocks for wraparound care activities
    if (type === 'wraparound_care' && sessionBlocks && sessionBlocks.length > 0) {
      await safePrismaQuery(async (client) => {
        // Create sessions for all dates between start and end date
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const sessions = [];
        
        // Generate all dates between start and end date
        for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
          const session = await client.session.create({
            data: {
              activityId: activity.id,
              date: new Date(date),
              startTime: '09:00',
              endTime: '17:00',
              status: 'scheduled',
              capacity: activity.capacity,
              bookingsCount: 0
            }
          });
          sessions.push(session);
        }
        
        logger.info('Created sessions for wraparound care activity', {
          activityId: activity.id,
          startDate: startDate,
          endDate: endDate,
          sessionsCreated: sessions.length
        });

        // Create session blocks for each session
        for (const session of sessions) {
          const sessionBlockData = sessionBlocks.map((block: any) => ({
            sessionId: session.id,
            activityId: activity.id,
            name: block.name,
            startTime: block.startTime,
            endTime: block.endTime,
            capacity: block.capacity || 0,
            price: block.price || price || 5.00, // Use session block price, then base price, then default £5
            isActive: true
          }));

          await client.sessionBlock.createMany({
            data: sessionBlockData
          });
        }
      });
    }

    // Create sessions and holiday time slots for holiday club activities
    if (type === 'holiday_club') {
      try {
        await safePrismaQuery(async (client) => {
          // Generate individual dates based on start/end date and days of week
          const generateSessionDates = () => {
            if (!startDate || !endDate) return [];
            
            const dates: string[] = [];
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Map day names to numbers (Monday = 1, Sunday = 0)
            const dayMap: { [key: string]: number } = {
              'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
              'friday': 5, 'saturday': 6, 'sunday': 0
            };

            const selectedDays = (daysOfWeek || []).map((day: string) => dayMap[day.toLowerCase()]);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dayOfWeek = d.getDay();
              const dateString = d.toISOString().split('T')[0];
              
              // Skip excluded dates
              if (excludeDates && excludeDates.includes(dateString || '')) continue;
              
              // If daysOfWeek is specified, only include those days
              if (selectedDays.length > 0) {
                if (selectedDays.includes(dayOfWeek)) {
                  dates.push(dateString || '');
                }
              } else {
                // Default to weekdays only if no specific days selected
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                  dates.push(dateString || '');
                }
              }
            }

            return dates;
          };

          const sessionDates = generateSessionDates();
          
          // Only create sessions if we have valid dates
          if (sessionDates.length === 0) {
            logger.warn('No valid session dates generated for holiday club activity', { 
              activityId: activity.id, 
              startDate, 
              endDate, 
              daysOfWeek,
              excludeDates 
            });
            return;
          }

          logger.info('Creating sessions for holiday club', { 
            activityId: activity.id, 
            sessionDatesCount: sessionDates.length 
          });

          // Create sessions for each date
          for (const date of sessionDates) {
            const session = await client.session.create({
              data: {
                activityId: activity.id,
                date: new Date(date),
                startTime: startTime || '09:00',
                endTime: endTime || '17:00',
                status: 'scheduled',
                capacity: capacity || 20,
                bookingsCount: 0
              }
            });

            // Create holiday time slots for this session
            const defaultTimeSlots = [
              { name: 'Standard Day', startTime: startTime || '09:00', endTime: endTime || '17:00', price: price || 25.00, capacity: capacity || 20 },
              ...(earlyDropoff ? [{ name: 'Early Drop-off', startTime: earlyDropoffStartTime || '08:00', endTime: earlyDropoffEndTime || '09:00', price: earlyDropoffPrice || 30.00, capacity: capacity || 20 }] : []),
              ...(latePickup ? [{ name: 'Late Pick-up', startTime: latePickupStartTime || '17:00', endTime: latePickupEndTime || '18:00', price: latePickupPrice || 35.00, capacity: capacity || 20 }] : [])
            ];

            const allTimeSlots = customTimeSlots && customTimeSlots.length > 0 ? customTimeSlots : defaultTimeSlots;

            if (allTimeSlots.length > 0) {
              const holidayTimeSlotData = allTimeSlots.map((slot: any) => ({
          activityId: activity.id,
                sessionId: session.id,
          name: slot.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: slot.price || 0,
          capacity: slot.capacity || 0,
                bookingsCount: 0,
          isActive: true
        }));

        await client.holidayTimeSlot.createMany({
          data: holidayTimeSlotData
        });
            }
          }
      });
      } catch (error) {
        logger.error('Error creating holiday club sessions:', error);
        // Don't throw here - let the activity creation succeed even if session creation fails
        // The activity can still be created and sessions can be added later
      }
    }

    logger.info('Business activity created successfully', { userId, activityId: activity.id });

    res.status(201).json({
      success: true,
      data: {
        activity: {
          id: activity.id,
          name: activity.title,
          type: activity.type,
          venue: activity.venue.name,
          startDate: activity.startDate,
          endDate: activity.endDate,
          capacity: activity.capacity,
          price: activity.price,
          status: activity.status,
          createdAt: activity.createdAt
        }
      },
      message: 'Activity created successfully'
    });

  } catch (error) {
    logger.error('Error creating business activity:', error);
    throw new AppError('Failed to create activity', 500, 'ACTIVITY_CREATE_ERROR');
  }
}));

// Temporary endpoint to fix existing Course/Program activities
router.patch('/fix-course-durations', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  try {
    // Check if user has admin access
    const userInfo = await safePrismaQuery(async (client) => {
      return await client.user.findUnique({
        where: { id: userId },
        select: { role: true, businessName: true, isActive: true }
      });
    });

    if (!userInfo || userInfo.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
    }

    // Get all Course/Program activities without durationWeeks
    const activities = await safePrismaQuery(async (client) => {
      return await client.activity.findMany({
        where: {
          type: 'course/program',
          durationWeeks: null
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          daysOfWeek: true,
          courseExcludeDates: true
        }
      });
    });

    let updatedCount = 0;

    for (const activity of activities) {
      if (activity.startDate && activity.endDate && activity.daysOfWeek && activity.daysOfWeek.length > 0) {
        const startDate = new Date(activity.startDate);
        const endDate = new Date(activity.endDate);
        let totalSessions = 0;
        
        // Calculate sessions for each selected day
        activity.daysOfWeek.forEach((dayName: string) => {
          const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(capitalizedDayName);
          
          if (dayOfWeek !== -1) {
            // Find first occurrence of this day within date range
            const firstSessionDate = new Date(startDate);
            const daysUntilFirstSession = (dayOfWeek - startDate.getDay() + 7) % 7;
            firstSessionDate.setDate(startDate.getDate() + daysUntilFirstSession);
            
            // If first session date is before start date, move to next week
            if (firstSessionDate < startDate) {
              firstSessionDate.setDate(firstSessionDate.getDate() + 7);
            }
            
            // Count sessions for this day within date range
            let currentSessionDate = new Date(firstSessionDate);
            while (currentSessionDate <= endDate) {
              const dateString = currentSessionDate.toISOString().split('T')[0];
              // Only count if not excluded
              if (!activity.courseExcludeDates.includes(dateString)) {
                totalSessions++;
              }
              currentSessionDate.setDate(currentSessionDate.getDate() + 7);
            }
          }
        });
        
        // Update the activity with calculated durationWeeks
        if (totalSessions > 0) {
          await safePrismaQuery(async (client) => {
            return await client.activity.update({
              where: { id: activity.id },
              data: { durationWeeks: totalSessions }
            });
          });
          updatedCount++;
        }
      }
    }

    logger.info('Course duration fix completed', { userId, updatedCount, totalActivities: activities.length });

    res.json({
      success: true,
      message: `Updated ${updatedCount} Course/Program activities with durationWeeks`,
      data: {
        updatedCount,
        totalActivities: activities.length
      }
    });

  } catch (error) {
    logger.error('Error fixing course durations:', error);
    throw new AppError('Failed to fix course durations', 500, 'COURSE_DURATION_FIX_ERROR');
  }
}));

// Update activity
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activityId = req.params['id'];
  const { 
    title, name, type, venueId, startDate, endDate, startTime, endTime, capacity, price, description, status,
    daysOfWeek, proRataBooking, holidaySessions,
    // Holiday Club fields
    ageRange, whatToBring, earlyDropoff, earlyDropoffPrice, earlyDropoffStartTime, earlyDropoffEndTime, latePickup, latePickupPrice, latePickupStartTime, latePickupEndTime, excludeDates,
    siblingDiscount, bulkDiscount, weeklyDiscount,
    // Wraparound Care fields
    isWraparoundCare, yearGroups,
    // Course/Program specific fields
    durationWeeks, regularDay, regularTime, courseExcludeDates
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

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Check if activity exists and belongs to user
    const existingActivity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId || '',
          venueId: { in: venueIds }
        }
      });
    });

    if (!existingActivity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Update activity
    const activity = await safePrismaQuery(async (client) => {
      return await client.activity.update({
        where: { id: activityId || '' },
        data: {
          title: title || name,
          type: type,
          description: description,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          startTime: startTime,
          endTime: endTime,
          capacity: capacity,
          price: price,
          venueId: venueId,
          status: status,
          daysOfWeek: daysOfWeek,
          proRataBooking: proRataBooking,
          holidaySessions: holidaySessions,
          // Holiday Club fields
          ageRange: ageRange,
          whatToBring: whatToBring,
          earlyDropoff: earlyDropoff,
          earlyDropoffPrice: earlyDropoffPrice,
          earlyDropoffStartTime: earlyDropoffStartTime,
          earlyDropoffEndTime: earlyDropoffEndTime,
          latePickup: latePickup,
          latePickupPrice: latePickupPrice,
          latePickupStartTime: latePickupStartTime,
          latePickupEndTime: latePickupEndTime,
          excludeDates: excludeDates,
          siblingDiscount: siblingDiscount,
          bulkDiscount: bulkDiscount,
          weeklyDiscount: weeklyDiscount,
          // Wraparound Care fields
          isWraparoundCare: isWraparoundCare,
          yearGroups: yearGroups,
          // Course/Program specific fields
          durationWeeks: durationWeeks,
          regularDay: regularDay,
          regularTime: regularTime,
          courseExcludeDates: courseExcludeDates
        } as any,
        include: {
          venue: {
            select: { id: true, name: true }
          }
        }
      });
    });

    logger.info('Business activity updated successfully', { userId, activityId });

    res.json({
      success: true,
      data: {
        activity: {
          id: activity.id,
          name: activity.title,
          type: activity.type,
          venue: (activity as any).venue?.name || 'Unknown Venue',
          startDate: activity.startDate,
          endDate: activity.endDate,
          capacity: activity.capacity,
          price: activity.price,
          status: activity.status,
          updatedAt: activity.updatedAt
        }
      },
      message: 'Activity updated successfully'
    });

  } catch (error) {
    logger.error('Error updating business activity:', error);
    throw new AppError('Failed to update activity', 500, 'ACTIVITY_UPDATE_ERROR');
  }
}));

// Delete activity
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activityId = req.params['id'];
  
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

    // Get user's venues
    const venues = await safePrismaQuery(async (client) => {
      return await client.venue.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
    });

    const venueIds = venues.map(v => v.id);

    // Check if activity exists and belongs to user
    const existingActivity = await safePrismaQuery(async (client) => {
      return await client.activity.findFirst({
        where: {
          id: activityId || '',
          venueId: { in: venueIds }
        },
        include: {
          _count: {
            select: {
              bookings: true
            }
          }
        }
      });
    });

    if (!existingActivity) {
      throw new AppError('Activity not found or access denied', 404, 'ACTIVITY_NOT_FOUND');
    }

    // Check if activity has bookings
    if ((existingActivity as any)._count?.bookings > 0) {
      throw new AppError('Cannot delete activity with existing bookings', 400, 'ACTIVITY_HAS_BOOKINGS');
    }

    // Delete activity
    await safePrismaQuery(async (client) => {
      return await client.activity.delete({
        where: { id: activityId || '' }
      });
    });

    logger.info('Business activity deleted successfully', { userId, activityId });

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting business activity:', error);
    throw new AppError('Failed to delete activity', 500, 'ACTIVITY_DELETE_ERROR');
  }
}));

export default router;
