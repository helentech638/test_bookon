import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req: Request, _res: Response, next: Function) => {
    if (!req.user) {
        throw new AppError('User not authenticated', 401, 'USER_NOT_AUTHENTICATED');
    }

    if (!['admin', 'staff'].includes(req.user.role)) {
        throw new AppError('Admin or staff access required', 403, 'ADMIN_ACCESS_REQUIRED');
    }
    next();
};

// Get master report data
router.get('/master-report', authenticateToken, requireAdminOrStaff, asyncHandler(async (req: Request, res: Response) => {
    try {
        const { dateFrom, dateTo, franchiseId, venueId } = req.query;

        logger.info('Master report requested', { dateFrom, dateTo, franchiseId, venueId });

        // Mock data for now based on the frontend interface
        const reportData = {
            reportPeriod: {
                from: dateFrom as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                to: dateTo as string || new Date().toISOString(),
                generatedAt: new Date().toISOString()
            },
            summary: {
                totalFranchises: 5,
                totalVenues: 12,
                totalParents: 450,
                totalBookings: 1240,
                totalRevenue: 45680.50,
                totalFranchiseFees: 4568.05,
                totalRefunds: 1250.00,
                totalCredits: 850.00
            },
            franchises: [
                {
                    id: '1',
                    name: 'North London Franchise',
                    venueCount: 3,
                    totalRevenue: 15200,
                    totalBookings: 420,
                    totalFranchiseFees: 1520,
                    netRevenue: 13680,
                    averageBookingValue: 36.19
                },
                {
                    id: '2',
                    name: 'Manchester Franchise',
                    venueCount: 2,
                    totalRevenue: 12400,
                    totalBookings: 310,
                    totalFranchiseFees: 1240,
                    netRevenue: 11160,
                    averageBookingValue: 40.00
                }
            ],
            venues: [
                {
                    id: '1',
                    name: 'Central Sports Hub',
                    address: '123 Sport St',
                    city: 'London',
                    businessAccountName: 'North London Franchise',
                    activityCount: 15,
                    totalRevenue: 8500,
                    totalBookings: 210,
                    netRevenue: 7650,
                    averageBookingValue: 40.48,
                    capacityUtilization: 85.5
                }
            ],
            parents: [
                {
                    id: '1',
                    email: 'parent@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    childrenCount: 2,
                    totalSpent: 450,
                    totalBookings: 12,
                    totalRefunds: 0,
                    totalCredits: 0,
                    netSpent: 450,
                    averageBookingValue: 37.5,
                    lastBookingDate: new Date().toISOString()
                }
            ],
            financials: {
                totalRevenue: 45680.50,
                totalRefunds: 1250.00,
                totalCredits: 850.00,
                totalFranchiseFees: 4568.05,
                netRevenue: 39012.45,
                revenueByPaymentMethod: {
                    card: 35000.50,
                    tfc: 8000.00,
                    credit: 2680.00
                }
            },
            bookings: {
                totalBookings: 1240,
                confirmedBookings: 1150,
                pendingBookings: 50,
                cancelledBookings: 40,
                averageBookingValue: 36.84,
                peakBookingDay: 'Saturday',
                peakBookingTime: '10:00 AM'
            },
            payments: {
                cardRevenue: 35000.50,
                tfcRevenue: 8000.00,
                creditRevenue: 2680.00,
                otherRevenue: 0,
                paidCount: 1100,
                pendingCount: 80,
                failedCount: 20,
                refundedCount: 40
            }
        };

        res.json({
            success: true,
            data: reportData
        });
    } catch (error) {
        logger.error('Error fetching master report:', error);
        throw new AppError('Failed to fetch master report', 500, 'MASTER_REPORT_ERROR');
    }
}));

export default router;
