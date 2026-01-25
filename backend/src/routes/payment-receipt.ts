import express from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import PDFDocument from 'pdfkit';
import { emailService } from '../services/emailService';

const router = express.Router();

// Generate and download PDF receipt
router.post('/download-receipt', asyncHandler(async (req, res) => {
  const { paymentIntentId, bookingData, amount, currency } = req.body;

  if (!paymentIntentId || !bookingData) {
    throw new AppError('Missing required data for receipt generation', 400);
  }

  try {
    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${paymentIntentId.slice(-8)}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(20)
       .fillColor('#00806a')
       .text('BookOn', 50, 50)
       .fontSize(12)
       .fillColor('#666')
       .text('Activity Booking Receipt', 50, 80);

    // Add receipt details
    doc.fontSize(14)
       .fillColor('#000')
       .text('Receipt Details', 50, 120)
       .fontSize(10)
       .fillColor('#666')
       .text(`Receipt ID: ${paymentIntentId.slice(-8)}`, 50, 150)
       .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 50, 170)
       .text(`Time: ${new Date().toLocaleTimeString('en-GB')}`, 50, 190);

    // Add booking information
    doc.fontSize(12)
       .fillColor('#000')
       .text('Booking Information', 50, 220)
       .fontSize(10)
       .fillColor('#666');

    let yPosition = 250;
    
    if (bookingData.courseBookings && bookingData.courseBookings.length > 0) {
      const courseBooking = bookingData.courseBookings[0];
      doc.text(`Activity: ${bookingData.activity?.title || 'Course Activity'}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Child: ${courseBooking.childName || 'N/A'}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Venue: ${bookingData.venue?.name || 'N/A'}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Schedule: ${bookingData.courseSchedule || 'Course Schedule'}`, 50, yPosition);
      yPosition += 20;
    }

    // Add payment information
    doc.fontSize(12)
       .fillColor('#000')
       .text('Payment Information', 50, yPosition + 20)
       .fontSize(10)
       .fillColor('#666')
       .text(`Amount: ${new Intl.NumberFormat('en-GB', {
         style: 'currency',
         currency: currency.toUpperCase(),
       }).format(amount)}`, 50, yPosition + 50)
       .text(`Payment Method: Card Payment`, 50, yPosition + 70)
       .text(`Payment Status: Completed`, 50, yPosition + 90);

    // Add footer
    doc.fontSize(8)
       .fillColor('#999')
       .text('Thank you for choosing BookOn!', 50, doc.page.height - 100)
       .text('For support, contact us at support@bookon.app', 50, doc.page.height - 80)
       .text('This is an automated receipt. Please keep this for your records.', 50, doc.page.height - 60);

    // Finalize PDF
    doc.end();

    logger.info(`PDF receipt generated for payment ${paymentIntentId}`);
  } catch (error) {
    logger.error('Error generating PDF receipt:', error);
    throw new AppError('Failed to generate receipt', 500);
  }
}));

// Send confirmation email
router.post('/send-confirmation', asyncHandler(async (req, res) => {
  const { paymentIntentId, bookingData, amount, currency } = req.body;

  if (!paymentIntentId || !bookingData) {
    throw new AppError('Missing required data for email confirmation', 400);
  }

  try {
    // Get user information
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prepare email data
    const emailData = {
      to: user.email,
      parentName: `${user.firstName} ${user.lastName}`,
      childName: bookingData.courseBookings?.[0]?.childName || 'Your child',
      activityName: bookingData.activity?.title || 'Course Activity',
      venueName: bookingData.venue?.name || 'Venue',
      amount: amount,
      currency: currency,
      paymentIntentId: paymentIntentId,
      bookingDate: new Date().toLocaleDateString('en-GB'),
      courseSchedule: bookingData.courseSchedule || 'Course Schedule',
      venuePhone: bookingData.venue?.phone || 'N/A',
      venueEmail: bookingData.venue?.email || 'N/A'
    };

    // Send payment confirmation email
    await emailService.sendPaymentReceipt(emailData);

    logger.info(`Payment confirmation email sent to ${user.email} for payment ${paymentIntentId}`);

    res.json({
      success: true,
      message: 'Confirmation email sent successfully'
    });
  } catch (error) {
    logger.error('Error sending confirmation email:', error);
    throw new AppError('Failed to send confirmation email', 500);
  }
}));

export default router;
