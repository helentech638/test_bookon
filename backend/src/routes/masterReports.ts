import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';
import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';
import * as ExcelJS from 'exceljs';
const PDFDocument = require('pdfkit');

const router = Router();

// Debug endpoint to test PDF generation
router.get('/debug-pdf', asyncHandler(async (_req: Request, res: Response) => {
  try {
    logger.info('Testing PDF generation debug endpoint');
    
    // Test with minimal data
    const testData = {
      reportPeriod: {
        from: new Date('2025-08-24'),
        to: new Date('2025-09-24'),
        generatedAt: new Date()
      },
      summary: {
        totalRevenue: 1000,
        totalVenues: 5,
        totalParents: 10,
        totalBookings: 25,
        totalFranchiseFees: 100,
        totalRefunds: 50,
        totalCredits: 25
      },
      payments: {
        cardRevenue: 800,
        tfcRevenue: 150,
        otherRevenue: 50
      },
      franchises: [],
      venues: [],
      parents: [],
      financials: {
        totalRevenue: 1000,
        totalFranchiseFees: 100,
        netRevenue: 900,
        totalRefunds: 50,
        revenueByPaymentMethod: {
          card: 800,
          tfc: 150,
          credit: 50
        }
      },
      bookings: {
        totalBookings: 25,
        bookingsByStatus: { confirmed: 20, pending: 5 },
        bookingsByPaymentMethod: { card: 20, tfc: 5 },
        averageBookingValue: 40
      }
    };
    
    return generateProfessionalPDFReport(testData, res);
    
  } catch (error) {
    logger.error('Error in debug PDF endpoint:', error);
    res.status(500).json({ 
      error: 'Debug PDF generation failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Test Data Check
router.get('/test-data', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Check total payments in database
    const totalPayments = await prisma.payment.count();
    
    // Check recent payments
    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            activity: {
              include: {
                venue: true
              }
            }
          }
        }
      }
    });

    // Check franchises
    const franchises = await prisma.businessAccount.findMany({
      take: 5,
      include: {
        venues: {
          take: 2,
          include: {
            activities: {
              take: 2
            }
          }
        }
      }
    });

    res.json({
      totalPayments,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.booking?.paymentMethod || 'unknown',
        status: p.status,
        createdAt: p.createdAt,
        venueName: p.booking?.activity?.venue?.name || 'N/A'
      })),
      franchises: franchises.map(f => ({
        id: f.id,
        name: f.name,
        venueCount: f.venues.length,
        totalActivities: f.venues.reduce((sum, v) => sum + v.activities.length, 0)
      }))
    });
  } catch (error) {
    logger.error('Error checking test data:', error);
    res.status(500).json({ error: 'Failed to check test data' });
  }
}));

// Test PDF Generation - Simple Version
router.get('/test-pdf-simple', asyncHandler(async (_req: Request, res: Response) => {
  try {
    logger.info('Starting simple test PDF generation');
    
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-simple.pdf"');
    
    doc.pipe(res);
    
    // Simple content
    doc.fontSize(24).text('BookOn Test PDF', 50, 100);
    doc.fontSize(16).text('Generated: ' + new Date().toLocaleString(), 50, 140);
    doc.fontSize(12).text('This is a simple test PDF to verify generation works.', 50, 180);
    
    // Finalize
    doc.end();
    
    logger.info('Simple test PDF generation completed');
    
  } catch (error) {
    logger.error('Error generating simple test PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate test PDF', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}));

// Test PDF Generation - Full Version
router.get('/test-pdf', asyncHandler(async (_req: Request, res: Response) => {
  try {
    logger.info('Starting test PDF generation');
    
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      info: {
        Title: 'BookOn Test PDF',
        Author: 'BookOn Admin'
      }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test.pdf"');
    
    doc.pipe(res);
    
    // Title
    doc.fontSize(24).fillColor('#00806a').text('BookOn Test PDF', 50, 100, { align: 'center' });
    
    // Content
    doc.fontSize(16).fillColor('#333').text('This is a test PDF document', 50, 200);
    doc.fontSize(12).fillColor('#666').text('Generated at: ' + new Date().toISOString(), 50, 230);
    
    // Footer
    doc.fontSize(8).fillColor('#999').text('Generated by BookOn Test System', 50, 750, { align: 'center' });
    
    // Finalize
    doc.end();
    
    logger.info('Test PDF generation completed');
    
  } catch (error) {
    logger.error('Error generating test PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate test PDF', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}));

// Master Report - Comprehensive Admin Dashboard Data
router.get('/master-report', authenticateToken, requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { 
      dateFrom, 
      dateTo, 
      franchiseId, 
      venueId,
      format = 'json' // json, pdf, excel
    } = req.query;

    // Type cast query parameters
    const franchiseIdStr = Array.isArray(franchiseId) ? franchiseId[0] as string : franchiseId as string;
    const venueIdStr = Array.isArray(venueId) ? venueId[0] as string : venueId as string;

    const startDate = dateFrom ? new Date(dateFrom as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const endDate = dateTo ? new Date(dateTo as string) : new Date();

    logger.info('Master report requested', { 
      user: req.user?.email,
      dateFrom: startDate,
      dateTo: endDate,
      franchiseId,
      venueId,
      format
    });

    // Build where clause for filtering
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (venueId) {
      whereClause.activity = {
        venueId: venueId
      };
    }

    if (franchiseId) {
      whereClause.activity = {
        ...whereClause.activity,
        venue: {
          businessAccountId: franchiseId
        }
      };
    }

    // Get comprehensive data with error handling
    let franchiseData, venueData, parentData, financialData, bookingData, paymentData;
    
    try {
      [franchiseData, venueData, parentData, financialData, bookingData, paymentData] = await Promise.all([
      getFranchiseAnalytics(startDate, endDate, franchiseIdStr),
      getVenueAnalytics(startDate, endDate, venueIdStr),
      getParentAnalytics(startDate, endDate),
      getFinancialAnalytics(startDate, endDate, franchiseIdStr, venueIdStr),
      getBookingAnalytics(whereClause),
      getPaymentAnalytics(startDate, endDate, franchiseIdStr, venueIdStr)
    ]);
    } catch (analyticsError) {
      logger.error('Error fetching analytics data:', analyticsError);
      throw new Error(`Failed to fetch analytics data: ${analyticsError instanceof Error ? analyticsError.message : 'Unknown error'}`);
    }

    const masterReport = {
      reportPeriod: {
        from: startDate,
        to: endDate,
        generatedAt: new Date()
      },
      summary: {
        totalFranchises: franchiseData.totalFranchises,
        totalVenues: venueData.totalVenues,
        totalParents: parentData.totalParents,
        totalBookings: bookingData.totalBookings,
        totalRevenue: financialData.totalRevenue,
        totalFranchiseFees: financialData.totalFranchiseFees,
        totalRefunds: financialData.totalRefunds,
        totalCredits: financialData.totalCredits
      },
      franchises: franchiseData.franchises,
      venues: venueData.venues,
      parents: parentData.parents,
      financials: financialData,
      bookings: bookingData,
      payments: paymentData
    };

    // Debug logging
    logger.info('Master Report Data:', {
      paymentData: paymentData,
      franchiseData: franchiseData.franchises?.length || 0,
      venueData: venueData.venues?.length || 0,
      dateRange: { startDate, endDate }
    });

    if (format === 'pdf') {
      return generateProfessionalPDFReport(masterReport, res);
    } else if (format === 'excel') {
      return generateExcelReport(masterReport, res);
    }

    res.json({
      success: true,
      data: masterReport
    });

  } catch (error) {
    logger.error('Error generating master report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate master report', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}));

// Franchise Analytics - Use business users as franchises
async function getFranchiseAnalytics(startDate: Date, endDate: Date, franchiseId?: string) {
  const whereClause: any = {
    role: 'business'
  };

  if (franchiseId) {
    whereClause.id = franchiseId;
  }

  const businessUsers = await safePrismaQuery(async (client) => {
    return await client.user.findMany({
      where: whereClause,
      include: {
        venues: {
          include: {
            activities: {
              include: {
                bookings: {
                  where: {
                    createdAt: {
                      gte: startDate,
                      lte: endDate
                    }
                  },
                  include: {
                    payments: true,
                    refunds: true
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  const franchiseAnalytics = businessUsers.map(business => {
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalFranchiseFees = 0;
    let totalRefunds = 0;
    let totalCredits = 0;

    business.venues.forEach(venue => {
      venue.activities.forEach(activity => {
        activity.bookings.forEach(booking => {
          totalBookings++;
          totalRevenue += Number(booking.amount || 0);
          
          // Calculate franchise fees (placeholder for future implementation)
          totalFranchiseFees += 0;

          // Calculate refunds and credits
          booking.refunds.forEach(refund => {
            totalRefunds += Number(refund.amount || 0);
          });
        });
      });
    });

    return {
      id: business.id,
      name: business.businessName || `${business.firstName} ${business.lastName}`,
      email: business.email,
      venueCount: business.venues.length,
      totalRevenue,
      totalBookings,
      totalFranchiseFees,
      totalRefunds,
      totalCredits,
      netRevenue: totalRevenue - totalFranchiseFees - totalRefunds,
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0
    };
  });

  return {
    totalFranchises: businessUsers.length,
    franchises: franchiseAnalytics.sort((a, b) => b.totalRevenue - a.totalRevenue)
  };
}

// Venue Analytics
async function getVenueAnalytics(startDate: Date, endDate: Date, venueId?: string) {
  const whereClause: any = {};

  if (venueId) {
    whereClause.id = venueId;
  }

  const venues = await safePrismaQuery(async (client) => {
    return await client.venue.findMany({
      where: whereClause,
      include: {
        businessAccount: true,
        activities: {
          include: {
            bookings: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate
                }
              },
              include: {
                payments: true,
                refunds: true
              }
            }
          }
        }
      }
    });
  });

  const venueAnalytics = venues.map(venue => {
    let totalRevenue = 0;
    let totalBookings = 0;
    let totalRefunds = 0;
    let totalCredits = 0;

    venue.activities.forEach(activity => {
      activity.bookings.forEach(booking => {
        totalBookings++;
        totalRevenue += Number(booking.amount || 0);
        
        booking.refunds.forEach(refund => {
          totalRefunds += Number(refund.amount || 0);
        });
      });
    });

    return {
      id: venue.id,
      name: venue.name,
      address: venue.address,
      city: venue.city,
      businessAccountName: venue.businessAccount?.name || 'No Business Account',
      activityCount: venue.activities.length,
      totalRevenue,
      totalBookings,
      totalRefunds,
      totalCredits,
      netRevenue: totalRevenue - totalRefunds,
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      capacityUtilization: venue.capacity ? (totalBookings / venue.capacity) * 100 : 0
    };
  });

  return {
    totalVenues: venues.length,
    venues: venueAnalytics.sort((a, b) => b.totalRevenue - a.totalRevenue)
  };
}

// Parent Analytics
async function getParentAnalytics(startDate: Date, endDate: Date) {
  const parents = await safePrismaQuery(async (client) => {
    return await client.user.findMany({
      where: {
        role: 'parent'
      },
      include: {
        bookings: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            activity: {
              include: {
                venue: true
              }
            },
            payments: true,
            refunds: true
          }
        },
        children: true,
        walletCredits: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });
  });

  const parentAnalytics = parents.map(parent => {
    let totalSpent = 0;
    let totalBookings = 0;
    let totalRefunds = 0;
    let totalCredits = 0;

    parent.bookings.forEach(booking => {
      totalBookings++;
      totalSpent += Number(booking.amount || 0);
      
      booking.refunds.forEach(refund => {
        totalRefunds += Number(refund.amount || 0);
      });
    });

    parent.walletCredits.forEach(credit => {
      totalCredits += Number(credit.amount || 0);
    });

    return {
      id: parent.id,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      childrenCount: parent.children.length,
      totalSpent,
      totalBookings,
      totalRefunds,
      totalCredits,
      netSpent: totalSpent - totalRefunds,
      averageBookingValue: totalBookings > 0 ? totalSpent / totalBookings : 0,
      lastBookingDate: parent.bookings.length > 0 ? 
        parent.bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt : null
    };
  });

  return {
    totalParents: parents.length,
    parents: parentAnalytics.sort((a, b) => b.totalSpent - a.totalSpent)
  };
}

// Financial Analytics
async function getFinancialAnalytics(startDate: Date, endDate: Date, franchiseId?: string, venueId?: string) {
  const whereClause: any = {
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  };

  if (venueId) {
    whereClause.activity = {
      venueId: venueId
    };
  }

  if (franchiseId) {
    whereClause.activity = {
      ...whereClause.activity,
      venue: {
        businessAccountId: franchiseId
      }
    };
  }

  const [bookings, refunds, credits] = await Promise.all([
    safePrismaQuery(async (client) => {
      return await client.booking.findMany({
        where: whereClause,
        include: {
          activity: {
            include: {
              venue: {
                include: {
                  businessAccount: true
                }
              }
            }
          }
        }
      });
    }),
    safePrismaQuery(async (client) => {
      return await client.refundTransaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          booking: {
            include: {
              activity: {
                include: {
                  venue: true
                }
              }
            }
          }
        }
      });
    }),
    safePrismaQuery(async (client) => {
      return await client.walletCredit.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
    })
  ]);

  const totalRevenue = bookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0);
  const totalRefunds = refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const totalCredits = credits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0);

  // Calculate franchise fees
  const franchiseFees = bookings.reduce((sum, booking) => {
    const franchise = booking.activity.venue.businessAccount;
    if (franchise) {
      const franchiseFeeRate = franchise.franchiseFeeType === 'percent' 
        ? Number(franchise.franchiseFeeValue) / 100 
        : Number(franchise.franchiseFeeValue) / Number(booking.amount || 1);
      return sum + (Number(booking.amount || 0) * franchiseFeeRate);
    }
    return sum;
  }, 0);

  return {
    totalRevenue,
    totalRefunds,
    totalCredits,
    totalFranchiseFees: franchiseFees,
    netRevenue: totalRevenue - franchiseFees - totalRefunds,
    revenueByPaymentMethod: {
      card: bookings.filter(b => b.paymentMethod === 'card').reduce((sum, b) => sum + Number(b.amount || 0), 0),
      tfc: bookings.filter(b => b.paymentMethod === 'tfc').reduce((sum, b) => sum + Number(b.amount || 0), 0),
      credit: bookings.filter(b => b.paymentMethod === 'cash' || b.paymentMethod === 'bank_transfer').reduce((sum, b) => sum + Number(b.amount || 0), 0)
    }
  };
}

// Booking Analytics
async function getBookingAnalytics(whereClause: any) {
  const bookings = await safePrismaQuery(async (client) => {
    return await client.booking.findMany({
      where: whereClause,
      include: {
        activity: {
          include: {
            venue: true
          }
        },
        parent: true
      }
    });
  });

  const totalBookings = bookings.length;
  const bookingsByStatus = bookings.reduce((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bookingsByPaymentMethod = bookings.reduce((acc, booking) => {
    acc[booking.paymentMethod] = (acc[booking.paymentMethod] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalBookings,
    bookingsByStatus,
    bookingsByPaymentMethod,
    averageBookingValue: totalBookings > 0 ? 
      bookings.reduce((sum, b) => sum + Number(b.amount || 0), 0) / totalBookings : 0
  };
}

// Payment Analytics
async function getPaymentAnalytics(startDate: Date, endDate: Date, franchiseId?: string, venueId?: string) {
  try {
  const whereClause: any = {
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  };

  logger.info('Payment Analytics Query:', { whereClause, startDate, endDate, franchiseId, venueId });

  const payments = await safePrismaQuery(async (client) => {
    return await client.payment.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            activity: {
              include: {
                venue: {
                  include: {
                    businessAccount: true
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  logger.info('Payment Analytics Results:', { 
    totalPayments: payments.length,
    samplePayment: payments[0] || null 
  });

  const totalPayments = payments.length;
  
  // Calculate revenue by payment method (using paymentMethod from booking)
  const cardRevenue = payments
    .filter(p => p.booking?.paymentMethod === 'card')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  
  const tfcRevenue = payments
    .filter(p => p.booking?.paymentMethod === 'tfc')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  
  const creditRevenue = payments
    .filter(p => p.booking?.paymentMethod === 'cash' || p.booking?.paymentMethod === 'bank_transfer')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  
  const otherRevenue = payments
    .filter(p => !['card', 'tfc', 'cash', 'bank_transfer'].includes(p.booking?.paymentMethod || ''))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  // Calculate payment counts by status
  const paidCount = payments.filter(p => p.status === 'paid').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const failedCount = payments.filter(p => p.status === 'failed').length;
  const refundedCount = payments.filter(p => p.status === 'refunded').length;

  return {
    totalPayments,
    cardRevenue,
    tfcRevenue,
    creditRevenue,
    otherRevenue,
    paidCount,
    pendingCount,
    failedCount,
    refundedCount,
    totalAmount: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  };
  } catch (error) {
    logger.error('Error in getPaymentAnalytics:', error);
    // Return default values to prevent the entire report from failing
    return {
      totalPayments: 0,
      cardRevenue: 0,
      tfcRevenue: 0,
      creditRevenue: 0,
      otherRevenue: 0,
      paidCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundedCount: 0,
      totalAmount: 0
    };
  }
}


// Helper function to draw professional tables with proper text handling
function drawTable(doc: any, headers: string[], rows: any[][], startX: number, startY: number, options: any = {}) {
  const { 
    cellPadding = 10, 
    headerHeight = 35, 
    rowHeight = 30, 
    fontSize = 9,
    headerFontSize = 9,
    borderColor = '#00806a',
    headerBgColor = '#00806a',
    alternateRowColor = '#f8f9fa'
  } = options;

  const colWidths = options.colWidths || [];
  const totalWidth = colWidths.reduce((sum: number, width: number) => sum + width, 0);
  
  // Draw table border
  doc.rect(startX, startY, totalWidth, headerHeight + (rows.length * rowHeight))
     .stroke(borderColor);

  // Draw header
  doc.fillColor(headerBgColor);
  doc.rect(startX, startY, totalWidth, headerHeight).fill();
  
  doc.fillColor('white');
  doc.fontSize(headerFontSize).font('Helvetica-Bold');
  
  let currentX = startX;
  headers.forEach((header, index) => {
    const width = colWidths[index];
    const textY = startY + (headerHeight / 2) - (headerFontSize / 2);
    
        // For headers, don't wrap text - use the full width available
        // Use smaller font if header is too long for the column
        let currentHeaderFontSize = headerFontSize;
        if (header.length > 10 && width < 100) {
          currentHeaderFontSize = Math.max(8, headerFontSize - 1);
        }
    
    doc.fontSize(currentHeaderFontSize);
    doc.text(header, currentX + cellPadding, textY, {
      width: width - (cellPadding * 2),
      align: 'left',
      lineGap: 2,
      ellipsis: false // Prevent ellipsis for headers
    });
    currentX += width;
  });

  // Draw rows with proper text handling
  doc.fillColor('black');
  doc.fontSize(fontSize).font('Helvetica');
  
  rows.forEach((row, rowIndex) => {
    const rowY = startY + headerHeight + (rowIndex * rowHeight);
    
    // Alternate row background
    if (rowIndex % 2 === 1) {
      doc.fillColor(alternateRowColor);
      doc.rect(startX, rowY, totalWidth, rowHeight).fill();
      doc.fillColor('black');
    }
    
    // Draw row content with better text positioning
    currentX = startX;
    row.forEach((cell, cellIndex) => {
      const width = colWidths[cellIndex];
      const textY = rowY + (rowHeight / 2) - (fontSize / 2);
      
      // Handle long text by truncating with ellipsis
      let cellText = String(cell);
      // For email addresses, be more generous with length
      if (cellText.includes('@')) {
        if (cellText.length > 35) {
          cellText = cellText.substring(0, 32) + '...';
        }
      } else if (cellText.length > 20) {
        cellText = cellText.substring(0, 17) + '...';
      }
      
      doc.text(cellText, currentX + cellPadding, textY, {
        width: width - (cellPadding * 2),
        align: 'left',
        lineGap: 1
      });
      currentX += width;
    });
  });

  return startY + headerHeight + (rows.length * rowHeight) + 30;
}

// Generate Professional PDF Report (Premium Table-Based Layout)
async function generateProfessionalPDFReport(data: any, res: Response) {
  try {
    logger.info('Starting professional PDF generation');

    // Validate data before processing
    if (!data) {
      throw new Error('No data provided for PDF generation');
    }

    // Set headers first
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bookon-master-report-${new Date().toISOString().split('T')[0]}.pdf"`);

    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      info: {
        Title: 'BookOn Master Report',
        Author: 'BookOn Admin',
        Subject: 'Comprehensive Business Analytics Report'
      }
    });
    
    // Handle PDF generation errors
    doc.on('error', (error: Error) => {
      logger.error('PDF generation error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'PDF generation failed', 
          details: error.message 
        });
      }
    });
    
    doc.pipe(res);
    
    // PAGE 1: Executive Summary with Logo
    // Header with BookOn logo
    doc.rect(0, 0, 595, 60).fill('#00806a');
    
    // Add BookOn logo (simplified)
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('BookOn', 50, 20);
    
    // Title
    doc.fillColor('white').fontSize(20).text('Master Report', 120, 20, { bold: true });
    doc.fillColor('black');
    
    // Report period
    doc.fontSize(12).text('Report Period:', 50, 100);
    doc.fontSize(10).text(`From: ${data.reportPeriod?.from ? new Date(data.reportPeriod.from).toLocaleDateString() : 'N/A'}`, 70, 120);
    doc.text(`To: ${data.reportPeriod?.to ? new Date(data.reportPeriod.to).toLocaleDateString() : 'N/A'}`, 70, 135);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 70, 150);

    // Key metrics with visual elements
    if (data.summary) {
      doc.fontSize(14).text('Key Performance Indicators', 50, 180);
      doc.fontSize(12);
      let metricsY = 200;
      
      const metrics = [
        `• Total Revenue: £${data.summary.totalRevenue?.toFixed(2) || '0.00'}`,
        `• Total Venues: ${data.summary.totalVenues || 0}`,
        `• Total Parents: ${data.summary.totalParents || 0}`,
        `• Total Bookings: ${data.summary.totalBookings || 0}`,
        `• Franchise Fees: £${data.summary.totalFranchiseFees?.toFixed(2) || '0.00'}`,
        `• Net Revenue: £${(data.summary.totalRevenue - data.summary.totalFranchiseFees)?.toFixed(2) || '0.00'}`
      ];
      
      metrics.forEach(metric => {
        doc.text(metric, 70, metricsY);
        metricsY += 18;
      });
    }


    // PAGE 2: Franchise Performance with Charts
    if (data.franchises && data.franchises.length > 0) {
      doc.addPage();
      
      // Header with logo
      doc.rect(0, 0, 595, 60).fill('#00806a');
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('BookOn', 50, 20);
      doc.fillColor('white').fontSize(20).text('Franchise Performance', 120, 20, { bold: true });
      doc.fillColor('black');
      
      doc.fontSize(16).text('Top Franchises Performance', 50, 80);
      
      // Prepare table data
      const franchiseHeaders = ['Rank', 'Franchise Name', 'Venues', 'Revenue (£)', 'Bookings', 'Franchise Fees (£)', 'Net Revenue (£)', 'Avg Value (£)', 'Fee Rate'];
      const franchiseRows = data.franchises.slice(0, 10).map((franchise: any, index: number) => [
        index + 1,
        franchise.name || 'N/A',
        franchise.venueCount || 0,
        (franchise.totalRevenue || 0).toFixed(2),
        franchise.totalBookings || 0,
        (franchise.totalFranchiseFees || 0).toFixed(2),
        (franchise.netRevenue || 0).toFixed(2),
        (franchise.averageBookingValue || 0).toFixed(2),
        franchise.franchiseFeeRate ? `${franchise.franchiseFeeRate}%` : 'Fixed'
      ]);
      
      const franchiseColWidths = [40, 100, 55, 75, 60, 80, 80, 70, 65];
      
      // Draw franchise performance table
      const franchiseTableY = drawTable(doc, franchiseHeaders, franchiseRows, 20, 100, {
        colWidths: franchiseColWidths,
        headerHeight: 35,
        rowHeight: 30,
        fontSize: 8,
        headerFontSize: 8,
        cellPadding: 8
      });
      
      // Add franchise analytics summary
      doc.fontSize(12).text('Franchise Performance Summary:', 50, franchiseTableY);
      doc.fontSize(10);
      
      const totalFranchises = data.franchises.length;
      const totalFranchiseRevenue = data.franchises.reduce((sum: number, f: any) => sum + (f.totalRevenue || 0), 0);
      const totalFranchiseFees = data.franchises.reduce((sum: number, f: any) => sum + (f.totalFranchiseFees || 0), 0);
      const avgFranchiseRevenue = totalFranchises > 0 ? totalFranchiseRevenue / totalFranchises : 0;
      const topFranchise = data.franchises.length > 0 ? data.franchises.reduce((max: any, f: any) => 
        (f.totalRevenue || 0) > (max.totalRevenue || 0) ? f : max, data.franchises[0]) : {};
      
      doc.text(`• Total Franchises: ${totalFranchises}`, 70, franchiseTableY + 20);
      doc.text(`• Total Franchise Revenue: £${totalFranchiseRevenue.toFixed(2)}`, 70, franchiseTableY + 35);
      doc.text(`• Total Franchise Fees Collected: £${totalFranchiseFees.toFixed(2)}`, 70, franchiseTableY + 50);
      doc.text(`• Average Revenue per Franchise: £${avgFranchiseRevenue.toFixed(2)}`, 70, franchiseTableY + 65);
      doc.text(`• Top Performing Franchise: ${topFranchise.name || 'N/A'} (£${(topFranchise.totalRevenue || 0).toFixed(2)})`, 70, franchiseTableY + 80);
      
    }

    // PAGE 3: Venue Performance with Charts
    if (data.venues && data.venues.length > 0) {
      doc.addPage();
      
      // Header with logo
      doc.rect(0, 0, 595, 60).fill('#00806a');
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('BookOn', 50, 20);
      doc.fillColor('white').fontSize(20).text('Venue Performance', 120, 20, { bold: true });
      doc.fillColor('black');
      
      doc.fontSize(16).text('Top Venues Performance', 50, 80);
      
      // Prepare table data
      const venueHeaders = ['Rank', 'Venue Name', 'City', 'Business Account', 'Activities', 'Revenue (£)', 'Bookings', 'Capacity Util (%)', 'Avg Value (£)'];
      const venueRows = data.venues.slice(0, 15).map((venue: any, index: number) => [
        index + 1,
        venue.name || 'N/A',
        venue.city || 'N/A',
        venue.businessAccountName || 'N/A',
        venue.activityCount || 0,
        (venue.totalRevenue || 0).toFixed(2),
        venue.totalBookings || 0,
        `${(venue.capacityUtilization || 0).toFixed(1)}%`,
        (venue.averageBookingValue || 0).toFixed(2)
      ]);
      
      const venueColWidths = [40, 90, 60, 85, 55, 65, 55, 70, 65];
      
      // Draw venue performance table
      const venueTableY = drawTable(doc, venueHeaders, venueRows, 20, 100, {
        colWidths: venueColWidths,
        headerHeight: 35,
        rowHeight: 30,
        fontSize: 8,
        headerFontSize: 8,
        cellPadding: 8
      });
      
      // Add venue analytics summary
      doc.fontSize(12).text('Venue Performance Summary:', 50, venueTableY);
      doc.fontSize(10);
      
      const totalVenues = data.venues.length;
      const totalVenueRevenue = data.venues.reduce((sum: number, v: any) => sum + (v.totalRevenue || 0), 0);
      const avgVenueRevenue = totalVenues > 0 ? totalVenueRevenue / totalVenues : 0;
      const topVenue = data.venues.length > 0 ? data.venues.reduce((max: any, v: any) => 
        (v.totalRevenue || 0) > (max.totalRevenue || 0) ? v : max, data.venues[0]) : {};
      
      doc.text(`• Total Venues: ${totalVenues}`, 70, venueTableY + 20);
      doc.text(`• Total Venue Revenue: £${totalVenueRevenue.toFixed(2)}`, 70, venueTableY + 35);
      doc.text(`• Average Revenue per Venue: £${avgVenueRevenue.toFixed(2)}`, 70, venueTableY + 50);
      doc.text(`• Top Performing Venue: ${topVenue.name || 'N/A'} (£${(topVenue.totalRevenue || 0).toFixed(2)})`, 70, venueTableY + 65);
      
    }

    // PAGE 4: Financial Summary with Charts
    doc.addPage();
    
    // Header with logo
    doc.rect(0, 0, 595, 60).fill('#00806a');
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('BookOn', 50, 20);
    doc.fillColor('white').fontSize(20).text('Financial Summary', 120, 20, { bold: true });
    doc.fillColor('black');
    
    doc.fontSize(16).text('Financial Performance Overview', 50, 80);
    
    if (data.financials) {
      // Financial Metrics Table
      const financialHeaders = ['Metric', 'Amount (£)', 'Percentage'];
      const financialRows = [
        ['Gross Revenue', (data.financials.totalRevenue || 0).toFixed(2), '100.0%'],
        ['Franchise Fees', (data.financials.totalFranchiseFees || 0).toFixed(2), `${((data.financials.totalFranchiseFees || 0) / (data.financials.totalRevenue || 1) * 100).toFixed(1)}%`],
        ['Net Revenue', (data.financials.netRevenue || 0).toFixed(2), `${((data.financials.netRevenue || 0) / (data.financials.totalRevenue || 1) * 100).toFixed(1)}%`],
        ['Total Refunds', (data.financials.totalRefunds || 0).toFixed(2), `${((data.financials.totalRefunds || 0) / (data.financials.totalRevenue || 1) * 100).toFixed(1)}%`]
      ];
      
      const financialColWidths = [120, 100, 80];
      
      const financialTableY = drawTable(doc, financialHeaders, financialRows, 20, 100, {
        colWidths: financialColWidths,
        headerHeight: 35,
        rowHeight: 30,
        fontSize: 10,
        headerFontSize: 8,
        cellPadding: 8
      });
      
      // Payment Method Distribution Table
      doc.fontSize(14).text('Payment Method Distribution', 50, financialTableY + 20);
      
      const totalRevenue = data.financials.totalRevenue || 0;
      if (totalRevenue > 0) {
        const cardAmount = data.financials.revenueByPaymentMethod?.card || 0;
        const tfcAmount = data.financials.revenueByPaymentMethod?.tfc || 0;
        const otherAmount = data.financials.revenueByPaymentMethod?.credit || 0;
        
        const paymentHeaders = ['Payment Method', 'Amount (£)', 'Percentage', 'Transactions'];
        const paymentRows = [
          ['Card Payments', cardAmount.toFixed(2), `${((cardAmount / totalRevenue) * 100).toFixed(1)}%`, data.payments?.paidCount || 0],
          ['TFC Payments', tfcAmount.toFixed(2), `${((tfcAmount / totalRevenue) * 100).toFixed(1)}%`, data.payments?.paidCount || 0],
          ['Other Payments', otherAmount.toFixed(2), `${((otherAmount / totalRevenue) * 100).toFixed(1)}%`, data.payments?.paidCount || 0]
        ];
        
        const paymentColWidths = [120, 100, 80, 80];
        
        drawTable(doc, paymentHeaders, paymentRows, 20, financialTableY + 50, {
          colWidths: paymentColWidths,
          headerHeight: 35,
          rowHeight: 30,
          fontSize: 10,
          headerFontSize: 8,
          cellPadding: 8
        });
      }
    }

    // PAGE 5: Parent Analytics with Charts
    if (data.parents && data.parents.length > 0) {
      doc.addPage();
      
      // Header with logo
      doc.rect(0, 0, 595, 60).fill('#00806a');
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('BookOn', 50, 20);
      doc.fillColor('white').fontSize(20).text('Parent Analytics', 120, 20, { bold: true });
      doc.fillColor('black');
      
      doc.fontSize(16).text('Top Parents Performance', 50, 80);
      
      // Prepare table data
      const parentHeaders = ['Rank', 'Parent Name', 'Email', 'Children', 'Total Spent (£)', 'Bookings', 'Avg Value (£)', 'Last Booking'];
      const parentRows = data.parents.slice(0, 20).map((parent: any, index: number) => [
        index + 1,
        `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'N/A',
        parent.email || 'N/A',
        parent.childrenCount || 0,
        (parent.totalSpent || 0).toFixed(2),
        parent.totalBookings || 0,
        (parent.averageBookingValue || 0).toFixed(2),
        parent.lastBookingDate ? new Date(parent.lastBookingDate).toLocaleDateString() : 'N/A'
      ]);
      
      const parentColWidths = [40, 90, 120, 55, 75, 60, 75, 75];
      
      // Draw parent analytics table
      const parentTableY = drawTable(doc, parentHeaders, parentRows, 20, 100, {
        colWidths: parentColWidths,
        headerHeight: 35,
        rowHeight: 30,
        fontSize: 8,
        headerFontSize: 8,
        cellPadding: 8
      });
      
      // Add summary statistics below table
      doc.fontSize(12).text('Parent Analytics Summary:', 50, parentTableY);
      doc.fontSize(10);
      
      const totalParents = data.parents.length;
      const totalSpent = data.parents.reduce((sum: number, p: any) => sum + (p.totalSpent || 0), 0);
      const avgSpent = totalParents > 0 ? totalSpent / totalParents : 0;
      const topSpender = data.parents.length > 0 ? data.parents.reduce((max: any, p: any) => 
        (p.totalSpent || 0) > (max.totalSpent || 0) ? p : max, data.parents[0]) : {};
      
      doc.text(`• Total Parents: ${totalParents}`, 70, parentTableY + 20);
      doc.text(`• Total Revenue from Parents: £${totalSpent.toFixed(2)}`, 70, parentTableY + 35);
      doc.text(`• Average Spent per Parent: £${avgSpent.toFixed(2)}`, 70, parentTableY + 50);
      doc.text(`• Top Spender: ${topSpender.firstName || ''} ${topSpender.lastName || ''} (£${(topSpender.totalSpent || 0).toFixed(2)})`, 70, parentTableY + 65);
      
    }

    // Footer
    doc.fontSize(8).text('Generated by BookOn Master Reports System', 50, 750, { align: 'center' });
    
    // Finalize
    doc.end();
    
    logger.info('Professional PDF generation completed');
    
  } catch (error) {
    logger.error('Error generating professional PDF report:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF report', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
async function generateExcelReport(data: any, res: Response) {
  const workbook = new ExcelJS.Workbook();
  
  // Set workbook properties
  workbook.creator = 'BookOn Admin';
  workbook.lastModifiedBy = 'BookOn System';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = 'BookOn Master Report';
  workbook.description = 'Comprehensive Business Analytics Report';
  workbook.keywords = 'BookOn, Analytics, Report, Business Intelligence';
  
  // Summary Sheet with Executive Dashboard
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.mergeCells('A1:D1');
  summarySheet.getCell('A1').value = 'BookOn Master Report - Executive Summary';
  summarySheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF00806A' } };
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };
  
  summarySheet.mergeCells('A2:D2');
  summarySheet.getCell('A2').value = `Report Period: ${data.reportPeriod.from.toLocaleDateString()} - ${data.reportPeriod.to.toLocaleDateString()}`;
  summarySheet.getCell('A2').font = { size: 12 };
  summarySheet.getCell('A2').alignment = { horizontal: 'center' };
  
  summarySheet.mergeCells('A3:D3');
  summarySheet.getCell('A3').value = `Generated: ${data.reportPeriod.generatedAt.toLocaleDateString()}`;
  summarySheet.getCell('A3').font = { size: 10, color: { argb: 'FF666666' } };
  summarySheet.getCell('A3').alignment = { horizontal: 'center' };
  
  // Key Metrics Table
  summarySheet.getCell('A5').value = 'Key Performance Indicators';
  summarySheet.getCell('A5').font = { size: 14, bold: true };
  
  const metrics = [
    ['Total Revenue', `Â£${data.summary.totalRevenue.toFixed(2)}`],
    ['Total Franchises', data.summary.totalFranchises],
    ['Total Venues', data.summary.totalVenues],
    ['Total Parents', data.summary.totalParents],
    ['Total Bookings', data.summary.totalBookings],
    ['Total Franchise Fees', `Â£${data.summary.totalFranchiseFees.toFixed(2)}`],
    ['Total Refunds', `Â£${data.summary.totalRefunds.toFixed(2)}`],
    ['Total Credits Issued', `Â£${data.summary.totalCredits.toFixed(2)}`]
  ];
  
  metrics.forEach(([label, value], index) => {
    summarySheet.getCell(`A${6 + index}`).value = label;
    summarySheet.getCell(`B${6 + index}`).value = value;
    summarySheet.getCell(`A${6 + index}`).font = { bold: true };
    summarySheet.getCell(`B${6 + index}`).font = { color: { argb: 'FF00806A' } };
  });
  
  // Financial Breakdown Sheet
  const financialSheet = workbook.addWorksheet('Financial Analysis');
  financialSheet.getCell('A1').value = 'Financial Breakdown';
  financialSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF00806A' } };
  
  const financialData = [
    ['Total Gross Revenue', `Â£${data.financials.totalRevenue.toFixed(2)}`],
    ['Total Franchise Fees', `Â£${data.financials.totalFranchiseFees.toFixed(2)}`],
    ['Total Admin Fees', `Â£${data.financials.totalAdminFees.toFixed(2)}`],
    ['Total Stripe Fees', `Â£${data.financials.totalStripeFees.toFixed(2)}`],
    ['Total Net to Venues', `Â£${data.financials.totalNetToVenues.toFixed(2)}`],
    ['', ''],
    ['Payment Method Breakdown', ''],
    ['Card Payments', `Â£${data.payments.cardRevenue.toFixed(2)}`],
    ['TFC Payments', `Â£${data.payments.tfcRevenue.toFixed(2)}`],
    ['Credit Payments', `Â£${data.payments.creditRevenue.toFixed(2)}`],
    ['Other Payments', `Â£${data.payments.otherRevenue.toFixed(2)}`]
  ];
  
  financialData.forEach(([label, value], index) => {
    financialSheet.getCell(`A${3 + index}`).value = label || '';
    financialSheet.getCell(`B${3 + index}`).value = value || '';
    if (label && (label.includes('Breakdown') || label === '')) {
      financialSheet.getCell(`A${3 + index}`).font = { bold: true, size: 12 };
    } else {
      financialSheet.getCell(`A${3 + index}`).font = { bold: true };
      financialSheet.getCell(`B${3 + index}`).font = { color: { argb: 'FF00806A' } };
    }
  });
  
  // Franchise Performance Sheet
  const franchiseSheet = workbook.addWorksheet('Franchise Performance');
  franchiseSheet.getCell('A1').value = 'Franchise Performance Analysis';
  franchiseSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF00806A' } };
  
  const franchiseHeaders = ['Franchise Name', 'Venues', 'Revenue (Â£)', 'Bookings', 'Franchise Fees (Â£)', 'Net Revenue (Â£)', 'Avg Booking Value (Â£)'];
  franchiseHeaders.forEach((header, index) => {
    const cell = franchiseSheet.getCell(2, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00806A' } };
    cell.alignment = { horizontal: 'center' };
  });
  
  data.franchises.forEach((franchise: any, rowIndex: number) => {
    const row = rowIndex + 3;
    franchiseSheet.getCell(row, 1).value = franchise.name;
    franchiseSheet.getCell(row, 2).value = franchise.venueCount;
    franchiseSheet.getCell(row, 3).value = franchise.totalRevenue;
    franchiseSheet.getCell(row, 4).value = franchise.totalBookings;
    franchiseSheet.getCell(row, 5).value = franchise.totalFranchiseFees;
    franchiseSheet.getCell(row, 6).value = franchise.netRevenue;
    franchiseSheet.getCell(row, 7).value = franchise.averageBookingValue;
    
    // Format currency columns
    [3, 5, 6, 7].forEach(col => {
      franchiseSheet.getCell(row, col).numFmt = 'Â£#,##0.00';
    });
  });
  
  // Auto-fit columns
  franchiseSheet.columns.forEach(column => {
    column.width = 20;
  });
  
  // Venue Performance Sheet
  const venueSheet = workbook.addWorksheet('Venue Performance');
  venueSheet.getCell('A1').value = 'Venue Performance Analysis';
  venueSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF00806A' } };
  
  const venueHeaders = ['Venue Name', 'Address', 'City', 'Business Account', 'Activities', 'Revenue (Â£)', 'Bookings', 'Net Revenue (Â£)', 'Capacity Utilization (%)'];
  venueHeaders.forEach((header, index) => {
    const cell = venueSheet.getCell(2, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00806A' } };
    cell.alignment = { horizontal: 'center' };
  });
  
  data.venues.forEach((venue: any, rowIndex: number) => {
    const row = rowIndex + 3;
    venueSheet.getCell(row, 1).value = venue.name;
    venueSheet.getCell(row, 2).value = venue.address;
    venueSheet.getCell(row, 3).value = venue.city;
    venueSheet.getCell(row, 4).value = venue.businessAccountName || 'N/A';
    venueSheet.getCell(row, 5).value = venue.activityCount;
    venueSheet.getCell(row, 6).value = venue.totalRevenue;
    venueSheet.getCell(row, 7).value = venue.totalBookings;
    venueSheet.getCell(row, 8).value = venue.netRevenue;
    venueSheet.getCell(row, 9).value = venue.capacityUtilization;
    
    // Format currency and percentage columns
    [6, 8].forEach(col => {
      venueSheet.getCell(row, col).numFmt = 'Â£#,##0.00';
    });
    venueSheet.getCell(row, 9).numFmt = '0.00%';
  });
  
  venueSheet.columns.forEach(column => {
    column.width = 18;
  });
  
  // Parent Analytics Sheet
  const parentSheet = workbook.addWorksheet('Parent Analytics');
  parentSheet.getCell('A1').value = 'Parent Analytics';
  parentSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF00806A' } };
  
  const parentHeaders = ['Email', 'Name', 'Children', 'Total Spent (Â£)', 'Bookings', 'Refunds (Â£)', 'Credits (Â£)', 'Net Spent (Â£)', 'Avg Booking Value (Â£)', 'Last Booking'];
  parentHeaders.forEach((header, index) => {
    const cell = parentSheet.getCell(2, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00806A' } };
    cell.alignment = { horizontal: 'center' };
  });
  
  data.parents.forEach((parent: any, rowIndex: number) => {
    const row = rowIndex + 3;
    parentSheet.getCell(row, 1).value = parent.email;
    parentSheet.getCell(row, 2).value = `${parent.firstName} ${parent.lastName}`;
    parentSheet.getCell(row, 3).value = parent.childrenCount;
    parentSheet.getCell(row, 4).value = parent.totalSpent;
    parentSheet.getCell(row, 5).value = parent.totalBookings;
    parentSheet.getCell(row, 6).value = parent.totalRefunds;
    parentSheet.getCell(row, 7).value = parent.totalCredits;
    parentSheet.getCell(row, 8).value = parent.netSpent;
    parentSheet.getCell(row, 9).value = parent.averageBookingValue;
    parentSheet.getCell(row, 10).value = parent.lastBookingDate ? new Date(parent.lastBookingDate).toLocaleDateString() : 'N/A';
    
    // Format currency columns
    [4, 6, 7, 8, 9].forEach(col => {
      parentSheet.getCell(row, col).numFmt = 'Â£#,##0.00';
    });
  });
  
  parentSheet.columns.forEach(column => {
    column.width = 15;
  });
  
  // Booking Analytics Sheet
  const bookingSheet = workbook.addWorksheet('Booking Analytics');
  bookingSheet.getCell('A1').value = 'Booking Analytics';
  bookingSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF00806A' } };
  
  const bookingData = [
    ['Total Bookings', data.bookings.totalBookings],
    ['Confirmed Bookings', data.bookings.confirmedBookings],
    ['Pending Bookings', data.bookings.pendingBookings],
    ['Cancelled Bookings', data.bookings.cancelledBookings],
    ['Average Booking Value', data.bookings.averageBookingValue],
    ['Peak Booking Day', data.bookings.peakBookingDay || 'N/A'],
    ['Peak Booking Time', data.bookings.peakBookingTime || 'N/A']
  ];
  
  bookingData.forEach(([label, value], index) => {
    bookingSheet.getCell(`A${3 + index}`).value = label;
    bookingSheet.getCell(`B${3 + index}`).value = value;
    bookingSheet.getCell(`A${3 + index}`).font = { bold: true };
    if (typeof value === 'number' && value > 100) {
      bookingSheet.getCell(`B${3 + index}`).numFmt = 'Â£#,##0.00';
    }
  });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="master-report-${new Date().toISOString().split('T')[0]}.xlsx"`);
  
  await workbook.xlsx.write(res);
  res.end();
}

export default router;
