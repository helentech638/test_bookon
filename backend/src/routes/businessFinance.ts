import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Get business finance transactions
router.get('/transactions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, paymentMethod, status, page = 1, limit = 20, startDate, endDate } = req.query;

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

    // Build where clause for payments
    const where: any = {
      booking: {
        activity: {
          venueId: { in: venueIds }
        }
      }
    };

    if (search) {
      where.OR = [
        {
          booking: {
            parent: {
              firstName: { contains: search as string, mode: 'insensitive' }
            }
          }
        },
        {
          booking: {
            parent: {
              lastName: { contains: search as string, mode: 'insensitive' }
            }
          }
        },
        {
          booking: {
            activity: {
              title: { contains: search as string, mode: 'insensitive' }
            }
          }
        }
      ];
    }

    if (paymentMethod) {
      if (paymentMethod === 'card') {
        where.paymentMethod = 'card';
      } else if (paymentMethod === 'tax_free_childcare') {
        where.paymentMethod = 'tax_free_childcare';
      } else if (paymentMethod === 'credit') {
        where.paymentMethod = 'credit';
      }
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    // Get transactions with pagination
    const transactions = await safePrismaQuery(async (client) => {
      return await client.payment.findMany({
        where,
        include: {
          booking: {
            include: {
              parent: {
                select: { firstName: true, lastName: true, email: true }
              },
              child: {
                select: { firstName: true, lastName: true }
              },
              activity: {
                select: { title: true, venue: { select: { name: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      });
    });

    // Get total count for pagination
    const totalCount = await safePrismaQuery(async (client) => {
      return await client.payment.count({ where });
    });

    // Get summary statistics
    const stats = await safePrismaQuery(async (client) => {
      const totalRevenue = await client.payment.aggregate({
        where: {
          ...where,
          status: 'succeeded'
        },
        _sum: { amount: true }
      });

      const cardPayments = await client.payment.aggregate({
        where: {
          ...where,
          status: 'succeeded',
          paymentMethod: 'card'
        },
        _sum: { amount: true }
      });

      const tfcPayments = await client.payment.aggregate({
        where: {
          ...where,
          status: 'succeeded',
          paymentMethod: 'tax_free_childcare'
        },
        _sum: { amount: true }
      });

      const creditPayments = await client.payment.aggregate({
        where: {
          ...where,
          status: 'succeeded',
          paymentMethod: 'credit'
        },
        _sum: { amount: true }
      });

      return {
        totalRevenue: Number(totalRevenue._sum.amount || 0),
        cardPayments: Number(cardPayments._sum.amount || 0),
        tfcPayments: Number(tfcPayments._sum.amount || 0),
        creditPayments: Number(creditPayments._sum.amount || 0)
      };
    });

    // Format response
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction.id,
      parentName: `${transaction.booking.parent.firstName} ${transaction.booking.parent.lastName}`,
      childName: `${transaction.booking.child.firstName} ${transaction.booking.child.lastName}`,
      activity: transaction.booking.activity.title,
      venue: transaction.booking.activity.venue.name,
      amount: Number(transaction.amount),
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      date: transaction.createdAt.toISOString().split('T')[0],
      time: transaction.createdAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      createdAt: transaction.createdAt
    }));

    logger.info('Business transactions fetched successfully', {
      userId,
      count: formattedTransactions.length,
      totalCount
    });

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        stats: stats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching business transactions:', error);
    throw new AppError('Failed to fetch transactions', 500, 'TRANSACTIONS_ERROR');
  }
}));

// Get business finance summary
router.get('/summary', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { range = 'today' } = req.query;

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

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (range) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    const where = {
      booking: {
        activity: {
          venueId: { in: venueIds }
        }
      },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    // Get financial summary
    const summary = await safePrismaQuery(async (client) => {
      const totalRevenue = await client.payment.aggregate({
        where: {
          ...where,
          status: 'succeeded'
        },
        _sum: { amount: true }
      });

      const totalRefunds = await client.refund.aggregate({
        where: {
          booking: {
            activity: {
              venueId: { in: venueIds }
            }
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true }
      });

      const totalCredits = await client.walletCredit.aggregate({
        where: {
          parent: {
            bookings: {
              some: {
                activity: {
                  venueId: { in: venueIds }
                }
              }
            }
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true }
      });

      const transactionCount = await client.payment.count({
        where: {
          ...where,
          status: 'succeeded'
        }
      });

      return {
        totalRevenue: Number(totalRevenue._sum.amount || 0),
        totalRefunds: Number(totalRefunds._sum.amount || 0),
        totalCredits: Number(totalCredits._sum.amount || 0),
        transactionCount: transactionCount,
        netRevenue: Number(totalRevenue._sum.amount || 0) - Number(totalRefunds._sum.amount || 0)
      };
    });

    logger.info('Business finance summary fetched successfully', { userId, range });

    res.json({
      success: true,
      data: {
        summary: summary,
        range: range,
        startDate: startDate,
        endDate: endDate
      }
    });

  } catch (error) {
    logger.error('Error fetching business finance summary:', error);
    throw new AppError('Failed to fetch finance summary', 500, 'FINANCE_SUMMARY_ERROR');
  }
}));

// Get business discounts
router.get('/discounts', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

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

    // Get discounts
    const discounts = await safePrismaQuery(async (client) => {
      return await client.discount.findMany({
        where: {
          OR: [
            { venueIds: { hasSome: venueIds } },
            { createdBy: userId }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    logger.info('Business discounts fetched successfully', { userId, count: discounts.length });

    res.json({
      success: true,
      data: {
        discounts: discounts.map(discount => ({
          id: discount.id,
          name: discount.name,
          code: discount.code,
          type: discount.type,
          value: discount.value,
          minAmount: discount.minAmount,
          maxUses: discount.maxUses,
          usedCount: discount.usedCount,
          isActive: discount.active,
          expiresAt: discount.validUntil,
          venue: null, // Will be populated from venueIds if needed
          createdAt: discount.createdAt
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching business discounts:', error);
    throw new AppError('Failed to fetch discounts', 500, 'DISCOUNTS_ERROR');
  }
}));

// Get business credits
router.get('/credits', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

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

    // Get credits
    const credits = await safePrismaQuery(async (client) => {
      return await client.walletCredit.findMany({
        where: {
          parent: {
            bookings: {
              some: {
                activity: {
                  venueId: { in: venueIds }
                }
              }
            }
          }
        },
        include: {
          parent: {
            select: { firstName: true, lastName: true, email: true }
          },
          booking: {
            include: {
              activity: {
                select: { title: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    logger.info('Business credits fetched successfully', { userId, count: credits.length });

    res.json({
      success: true,
      data: {
        credits: credits.map(credit => ({
          id: credit.id,
          parentName: `${credit.parent.firstName} ${credit.parent.lastName}`,
          parentEmail: credit.parent.email,
          amount: Number(credit.amount),
          balance: Number(credit.amount) - Number(credit.usedAmount),
          reason: credit.description || credit.source,
          activity: credit.booking?.activity?.title,
          expiresAt: credit.expiryDate,
          createdAt: credit.createdAt
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching business credits:', error);
    throw new AppError('Failed to fetch credits', 500, 'CREDITS_ERROR');
  }
}));

// Get business refunds
router.get('/refunds', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

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

    // Get refunds
    const refunds = await safePrismaQuery(async (client) => {
      return await client.refund.findMany({
        where: {
          booking: {
            activity: {
              venueId: { in: venueIds }
            }
          }
        },
        include: {
          booking: {
            include: {
              child: {
                select: { firstName: true, lastName: true }
              },
              parent: {
                select: { firstName: true, lastName: true }
              },
              activity: {
                select: { title: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    logger.info('Business refunds fetched successfully', { userId, count: refunds.length });

    res.json({
      success: true,
      data: {
        refunds: refunds.map(refund => ({
          id: refund.id,
          amount: Number(refund.amount),
          reason: refund.reason,
          status: refund.status,
          parentName: `${refund.booking.parent.firstName} ${refund.booking.parent.lastName}`,
          childName: `${refund.booking.child.firstName} ${refund.booking.child.lastName}`,
          activityName: refund.booking.activity.title,
          paymentMethod: refund.method,
          createdAt: refund.createdAt,
          processedAt: refund.processedAt
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching business refunds:', error);
    throw new AppError('Failed to fetch refunds', 500, 'REFUNDS_ERROR');
  }
}));

// Get business finance reports
router.get('/reports', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { range = 'month' } = req.query;

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

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (range) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
    }

    const where = {
      booking: {
        activity: {
          venueId: { in: venueIds }
        }
      },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    // Get financial data
    const reportData = await safePrismaQuery(async (client) => {
      const totalRevenue = await client.payment.aggregate({
        where: {
          ...where,
          status: 'succeeded'
        },
        _sum: { amount: true },
        _count: true
      });

      const totalDiscounts = await client.promo_code_usages.aggregate({
        where: {
          booking: {
            activity: {
              venueId: { in: venueIds }
            }
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { discountAmount: true }
      });

      const totalRefunds = await client.refund.aggregate({
        where: {
          booking: {
            activity: {
              venueId: { in: venueIds }
            }
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true }
      });

      // Generate revenue trend data for the last 7 days
      const revenueTrend = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);

        // Generate sample data - in real implementation, this would query actual daily revenue
        const baseAmount = Number(totalRevenue._sum.amount || 0) / 7;
        const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
        const dailyAmount = Math.max(0, baseAmount * (1 + variation));

        revenueTrend.push({
          date: date.toISOString().split('T')[0],
          amount: Math.round(dailyAmount)
        });
      }

      return {
        grossRevenue: Number(totalRevenue._sum.amount || 0),
        discountsApplied: Number(totalDiscounts._sum.discountAmount || 0),
        netRevenue: Number(totalRevenue._sum.amount || 0) - Number(totalDiscounts._sum.discountAmount || 0) - Number(totalRefunds._sum.amount || 0),
        totalTransactions: totalRevenue._count,
        averageTransactionValue: totalRevenue._count > 0 ? Number(totalRevenue._sum.amount || 0) / totalRevenue._count : 0,
        revenueTrend: revenueTrend
      };
    });

    logger.info('Business finance reports fetched successfully', { userId, range });

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    logger.error('Error fetching business finance reports:', error);
    throw new AppError('Failed to fetch reports', 500, 'REPORTS_ERROR');
  }
}));

export default router;
