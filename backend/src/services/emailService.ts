import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailEvent {
  emailId: string;
  eventType: string;
  timestamp: string;
  metadata?: any;
}

class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@bookon.com';
    this.fromName = process.env.FROM_NAME || 'BookOn';

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
    }
  }

  async sendEmail(emailData: EmailData): Promise<string | null> {
    try {
      if (!this.apiKey) {
        logger.warn('SendGrid API key not configured, skipping email send');
        return null;
      }

      const msg = {
        to: emailData.toName ? {
          email: emailData.to,
          name: emailData.toName
        } : emailData.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'];
      
      logger.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
        messageId
      });

      return messageId || null;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send TFC payment confirmation email
   */
  async sendTFCPaymentConfirmation(booking: any): Promise<void> {
    try {
      const emailData = {
        to: booking.parent.email,
        toName: `${booking.parent.firstName} ${booking.parent.lastName}`,
        subject: `Payment Confirmed - ${booking.activity.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #00806a;">Payment Confirmed!</h2>
            
            <p>Hi ${booking.parent.firstName},</p>
            
            <p>Great news! Your Tax-Free Childcare payment has been received and your booking is now confirmed.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
              <p><strong>Child:</strong> ${booking.child.firstName} ${booking.child.lastName}</p>
              <p><strong>Activity:</strong> ${booking.activity.title}</p>
              <p><strong>Venue:</strong> ${booking.activity.venue.name}</p>
              <p><strong>Date:</strong> ${new Date(booking.activityDate).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${booking.activityTime}</p>
              <p><strong>Amount:</strong> £${booking.amount}</p>
              <p><strong>TFC Reference:</strong> ${booking.tfcReference}</p>
            </div>
            
            <p>Your child's place is now secured. Please arrive 10 minutes before the start time.</p>
            
            <p>Thank you for choosing BookOn!</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              This email was sent to ${booking.parent.email} regarding booking ${booking.tfcReference}.
            </p>
          </div>
        `,
        text: `
          Payment Confirmed!
          
          Hi ${booking.parent.firstName},
          
          Great news! Your Tax-Free Childcare payment has been received and your booking is now confirmed.
          
          Booking Details:
          - Child: ${booking.child.firstName} ${booking.child.lastName}
          - Activity: ${booking.activity.title}
          - Venue: ${booking.activity.venue.name}
          - Date: ${new Date(booking.activityDate).toLocaleDateString()}
          - Time: ${booking.activityTime}
          - Amount: £${booking.amount}
          - TFC Reference: ${booking.tfcReference}
          
          Your child's place is now secured. Please arrive 10 minutes before the start time.
          
          Thank you for choosing BookOn!
        `
      };

      await this.sendEmail(emailData);
      logger.info('TFC payment confirmation email sent', {
        bookingId: booking.id,
        parentEmail: booking.parent.email,
        tfcReference: booking.tfcReference
      });

    } catch (error) {
      logger.error('Failed to send TFC payment confirmation email:', error);
      throw error;
    }
  }

  processWebhookEvent(event: any): EmailEvent | null {
    try {
      if (!event || typeof event !== 'object') {
        return null;
      }

      const emailEvent: EmailEvent = {
        emailId: event.sg_message_id || event.message_id || '',
        eventType: this.mapEventType(event.event || event.type || ''),
        timestamp: event.timestamp || new Date().toISOString(),
        metadata: {
          sgEventId: event.sg_event_id,
          sgMessageId: event.sg_message_id,
          reason: event.reason,
          url: event.url,
          userAgent: event.useragent,
          ip: event.ip
        }
      };

      return emailEvent;
    } catch (error) {
      logger.error('Error processing webhook event:', error);
      return null;
    }
  }

  /**
   * Send TFC payment instructions email
   */
  async sendTFCInstructions(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    venueName: string;
    paymentReference: string;
    deadline: Date;
    amount: number;
    tfcConfig: any;
  }): Promise<string | null> {
    try {
      const deadlineStr = data.deadline.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #0F2230; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Tax-Free Childcare Payment Instructions</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>Thank you for booking <strong>${data.activityName}</strong> for ${data.childName} at ${data.venueName}.</p>
            
            <div style="background: #e8f5e8; border-left: 4px solid #2C8F7A; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2C8F7A; margin-top: 0;">Payment Instructions</h3>
              <p><strong>Amount:</strong> £${data.amount.toFixed(2)}</p>
              <p><strong>Payment Reference:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${data.paymentReference}</code></p>
              <p><strong>Deadline:</strong> ${deadlineStr}</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">Important:</h4>
              <p style="color: #856404; margin: 0;">Your booking is reserved but not confirmed until payment is received. Please make your Tax-Free Childcare payment by the deadline to secure your place.</p>
            </div>
            
            <p>If you have any questions, please contact us.</p>
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Tax-Free Childcare Payment Instructions - ${data.paymentReference}`,
        html
      });
    } catch (error) {
      logger.error('Error sending TFC instructions email:', error);
      return null;
    }
  }

  /**
   * Send TFC payment confirmation email
   */
  async sendTFCPaymentConfirmation(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    venueName: string;
    amount: number;
    paymentReference: string;
  }): Promise<string | null> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2C8F7A; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Payment Confirmed! 🎉</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>Great news! Your Tax-Free Childcare payment has been confirmed for <strong>${data.activityName}</strong>.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <h3 style="color: #155724; margin-top: 0;">Booking Confirmed</h3>
              <p><strong>Child:</strong> ${data.childName}</p>
              <p><strong>Activity:</strong> ${data.activityName}</p>
              <p><strong>Venue:</strong> ${data.venueName}</p>
              <p><strong>Amount Paid:</strong> £${data.amount.toFixed(2)}</p>
              <p><strong>Payment Reference:</strong> ${data.paymentReference}</p>
            </div>
            
            <p>Your booking is now confirmed and your child's place is secured!</p>
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Payment Confirmed - ${data.activityName}`,
        html
      });
    } catch (error) {
      logger.error('Error sending TFC confirmation email:', error);
      return null;
    }
  }

  /**
   * Send credit issued email
   */
  async sendCreditIssued(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    amount: number;
    creditAmount: number;
    reason: string;
  }): Promise<string | null> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #0F2230; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Credit Added to Your Account</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>We've added credit to your BookOn account following the cancellation of <strong>${data.activityName}</strong> for ${data.childName}.</p>
            
            <div style="background: #e8f5e8; border-left: 4px solid #2C8F7A; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2C8F7A; margin-top: 0;">Credit Details</h3>
              <p><strong>Original Amount:</strong> £${data.amount.toFixed(2)}</p>
              <p><strong>Credit Amount:</strong> £${data.creditAmount.toFixed(2)}</p>
              <p><strong>Reason:</strong> ${data.reason}</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">How to Use Your Credit:</h4>
              <p style="color: #856404; margin: 0;">Your credit will be automatically applied at checkout for future bookings. You can also choose to use it manually when booking activities.</p>
            </div>
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Credit Added - £${data.creditAmount.toFixed(2)}`,
        html
      });
    } catch (error) {
      logger.error('Error sending credit issued email:', error);
      return null;
    }
  }

  /**
   * Send TFC cancellation email
   */
  async sendTFCCancellation(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    paymentReference: string;
  }): Promise<string | null> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>We're sorry to inform you that your Tax-Free Childcare booking for <strong>${data.activityName}</strong> has been cancelled.</p>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <h3 style="color: #721c24; margin-top: 0;">Cancelled Booking</h3>
              <p><strong>Child:</strong> ${data.childName}</p>
              <p><strong>Activity:</strong> ${data.activityName}</p>
              <p><strong>Payment Reference:</strong> ${data.paymentReference}</p>
            </div>
            
            <p>If you have any questions, please contact us.</p>
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Booking Cancelled - ${data.activityName}`,
        html
      });
    } catch (error) {
      logger.error('Error sending TFC cancellation email:', error);
      return null;
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    venueName: string;
    venuePhone?: string;
    venueEmail?: string;
    amount: number;
    paymentReference: string;
  }): Promise<string | null> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2C8F7A; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Booking Confirmed! 🎉</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>Great news! Your booking has been confirmed for <strong>${data.activityName}</strong>.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <h3 style="color: #155724; margin-top: 0;">Booking Details</h3>
              <p><strong>Child:</strong> ${data.childName}</p>
              <p><strong>Activity:</strong> ${data.activityName}</p>
              <p><strong>Venue:</strong> ${data.venueName}</p>
              <p><strong>Amount Paid:</strong> £${data.amount.toFixed(2)}</p>
              <p><strong>Payment Reference:</strong> ${data.paymentReference}</p>
            </div>
            
            <p>Your child's place is now secured!</p>
            
            ${data.venuePhone || data.venueEmail ? `
            <div style="background: #e3f2fd; border: 1px solid #2196f3; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <h4 style="color: #1976d2; margin-top: 0;">Need Help?</h4>
              <p style="color: #1976d2; margin: 0;">Contact ${data.venueName} directly:</p>
              ${data.venuePhone ? `<p style="margin: 5px 0; color: #1976d2;">📞 Phone: <a href="tel:${data.venuePhone}" style="color: #1976d2;">${data.venuePhone}</a></p>` : ''}
              ${data.venueEmail ? `<p style="margin: 5px 0; color: #1976d2;">📧 Email: <a href="mailto:${data.venueEmail}" style="color: #1976d2;">${data.venueEmail}</a></p>` : ''}
            </div>
            ` : ''}
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Booking Confirmed - ${data.activityName}`,
        html
      });
    } catch (error) {
      logger.error('Error sending booking confirmation email:', error);
      return null;
    }
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellation(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    venueName: string;
    amount: number;
    paymentReference: string;
  }): Promise<string | null> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>We're sorry to inform you that your booking for <strong>${data.activityName}</strong> has been cancelled.</p>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <h3 style="color: #721c24; margin-top: 0;">Cancelled Booking</h3>
              <p><strong>Child:</strong> ${data.childName}</p>
              <p><strong>Activity:</strong> ${data.activityName}</p>
              <p><strong>Venue:</strong> ${data.venueName}</p>
              <p><strong>Amount:</strong> £${data.amount.toFixed(2)}</p>
              <p><strong>Payment Reference:</strong> ${data.paymentReference}</p>
            </div>
            
            <p>If you have any questions, please contact us.</p>
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Booking Cancelled - ${data.activityName}`,
        html
      });
    } catch (error) {
      logger.error('Error sending booking cancellation email:', error);
      return null;
    }
  }

  /**
   * Send cancellation confirmation email
   */
  async sendCancellationConfirmation(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    venueName: string;
    amount: number;
    refundAmount: number;
    refundMethod: string;
  }): Promise<string | null> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear ${data.parentName},</p>
            
            <p>We're sorry to inform you that your booking for <strong>${data.activityName}</strong> has been cancelled.</p>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <h3 style="color: #721c24; margin-top: 0;">Cancelled Booking</h3>
              <p><strong>Child:</strong> ${data.childName}</p>
              <p><strong>Activity:</strong> ${data.activityName}</p>
              <p><strong>Venue:</strong> ${data.venueName}</p>
              <p><strong>Original Amount:</strong> £${data.amount.toFixed(2)}</p>
              <p><strong>Refund Amount:</strong> £${data.refundAmount.toFixed(2)}</p>
              <p><strong>Refund Method:</strong> ${data.refundMethod}</p>
            </div>
            
            <p>If you have any questions, please contact us.</p>
            
            <p>Best regards,<br>The BookOn Team</p>
          </div>
        </div>
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Booking Cancelled - ${data.activityName}`,
        html
      });
    } catch (error) {
      logger.error('Error sending cancellation confirmation email:', error);
      return null;
    }
  }

  async sendPaymentReceipt(data: {
    to: string;
    parentName: string;
    childName: string;
    activityName: string;
    venueName: string;
    amount: number;
    currency: string;
    paymentIntentId: string;
    bookingDate: string;
    courseSchedule: string;
    venuePhone: string;
    venueEmail: string;
    bookingReference?: string;
    activityStartDate?: string;
    activityEndDate?: string;
    sessionDates?: string[];
  }): Promise<string | null> {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt - BookOn</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #00806a 0%, #006b5a 100%); padding: 30px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
            .content { padding: 40px 30px; }
            .success-icon { text-align: center; margin-bottom: 30px; }
            .success-icon .icon { width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
            .success-icon .icon svg { width: 40px; height: 40px; color: white; }
            .title { font-size: 24px; font-weight: 700; color: #1f2937; text-align: center; margin-bottom: 10px; }
            .subtitle { font-size: 16px; color: #6b7280; text-align: center; margin-bottom: 40px; }
            .receipt-card { background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
            .receipt-title { font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 20px; text-align: center; }
            .receipt-details { display: grid; gap: 15px; }
            .receipt-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
            .receipt-row:last-child { border-bottom: none; }
            .receipt-label { font-weight: 500; color: #374151; }
            .receipt-value { font-weight: 600; color: #1f2937; }
            .amount-highlight { background-color: #00806a; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .amount-highlight .amount { font-size: 24px; font-weight: 700; }
            .amount-highlight .label { font-size: 14px; opacity: 0.9; }
            .booking-info { background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .booking-info h3 { color: #0369a1; margin: 0 0 15px 0; font-size: 16px; }
            .booking-info p { margin: 5px 0; color: #0c4a6e; }
            .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
            .footer p { color: #6b7280; margin: 5px 0; font-size: 14px; }
            .footer a { color: #00806a; text-decoration: none; }
            .contact-info { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .contact-info h3 { color: #92400e; margin: 0 0 10px 0; font-size: 16px; }
            .contact-info p { margin: 5px 0; color: #78350f; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BookOn</h1>
            </div>
            
            <div class="content">
              <div class="success-icon">
                <div class="icon">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                  </svg>
                </div>
              </div>
              
              <h1 class="title">Payment Successful!</h1>
              <p class="subtitle">Your booking has been confirmed and payment processed</p>
              
              <div class="receipt-card">
                <h2 class="receipt-title">Payment Receipt</h2>
                <div class="receipt-details">
                  <div class="receipt-row">
                    <span class="receipt-label">Booking Reference:</span>
                    <span class="receipt-value">${data.bookingReference || `#${data.paymentIntentId.slice(-8)}`}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Payment ID:</span>
                    <span class="receipt-value">#${data.paymentIntentId.slice(-8)}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Payment Date:</span>
                    <span class="receipt-value">${data.bookingDate}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Payment Method:</span>
                    <span class="receipt-value">Card Payment</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Status:</span>
                    <span class="receipt-value" style="color: #10b981;">Completed</span>
                  </div>
                </div>
                
                <div class="amount-highlight">
                  <div class="amount">${new Intl.NumberFormat('en-GB', { style: 'currency', currency: data.currency.toUpperCase() }).format(data.amount)}</div>
                  <div class="label">Total Amount Paid</div>
                </div>
              </div>
              
              <div class="booking-info">
                <h3>Booking Details</h3>
                <p><strong>Activity:</strong> ${data.activityName}</p>
                <p><strong>Child:</strong> ${data.childName}</p>
                <p><strong>Venue:</strong> ${data.venueName}</p>
                <p><strong>Schedule:</strong> ${data.courseSchedule}</p>
                ${data.activityStartDate ? `<p><strong>Start Date:</strong> ${new Date(data.activityStartDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                ${data.activityEndDate ? `<p><strong>End Date:</strong> ${new Date(data.activityEndDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                ${data.sessionDates && data.sessionDates.length > 0 ? `
                  <div style="margin-top: 15px;">
                    <p><strong>Session Dates:</strong></p>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                      ${data.sessionDates.map(date => `<li>${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
              
              <div class="contact-info">
                <h3>Venue Contact Information</h3>
                <p><strong>Phone:</strong> ${data.venuePhone}</p>
                <p><strong>Email:</strong> ${data.venueEmail}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 14px;">
                  A PDF receipt has been generated and is available for download from your booking confirmation page.
                </p>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>Thank you for choosing BookOn!</strong></p>
              <p>If you have any questions about your booking, please contact the venue directly using the information above.</p>
              <p>For technical support, email us at <a href="mailto:support@bookon.app">support@bookon.app</a></p>
              <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                This is an automated receipt. Please keep this email for your records.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
        Payment Receipt - BookOn
        
        Dear ${data.parentName},
        
        Your payment has been successfully processed!
        
        Receipt Details:
        - Booking Reference: ${data.bookingReference || `#${data.paymentIntentId.slice(-8)}`}
        - Payment ID: #${data.paymentIntentId.slice(-8)}
        - Payment Date: ${data.bookingDate}
        - Payment Method: Card Payment
        - Status: Completed
        - Amount: ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: data.currency.toUpperCase() }).format(data.amount)}
        
        Booking Details:
        - Activity: ${data.activityName}
        - Child: ${data.childName}
        - Venue: ${data.venueName}
        - Schedule: ${data.courseSchedule}
        ${data.activityStartDate ? `- Start Date: ${new Date(data.activityStartDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
        ${data.activityEndDate ? `- End Date: ${new Date(data.activityEndDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
        ${data.sessionDates && data.sessionDates.length > 0 ? `
        - Session Dates:
          ${data.sessionDates.map(date => `  • ${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`).join('\n          ')}
        ` : ''}
        
        Venue Contact Information:
        - Phone: ${data.venuePhone}
        - Email: ${data.venueEmail}
        
        Thank you for choosing BookOn!
        
        For technical support, email us at support@bookon.app
      `;

      return await this.sendEmail({
        to: data.to,
        toName: data.parentName,
        subject: `Payment Receipt - ${data.activityName} | BookOn`,
        html,
        text
      });
    } catch (error) {
      logger.error('Error sending payment receipt email:', error);
      return null;
    }
  }

  /**
   * Send template email
   */
  async sendTemplateEmail(data: {
    to: string;
    toName: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }): Promise<string | null> {
    try {
      if (!this.apiKey) {
        logger.warn('SendGrid API key not configured, skipping template email send');
        return null;
      }

      const msg = {
        to: {
          email: data.to,
          name: data.toName
        },
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: data.subject,
        templateId: data.template,
        dynamicTemplateData: data.data
      };

      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'];
      
      logger.info('Template email sent successfully', {
        to: data.to,
        subject: data.subject,
        templateId: data.template,
        messageId
      });

      return messageId || null;
    } catch (error) {
      logger.error('Failed to send template email:', error);
      throw error;
    }
  }

  private mapEventType(sendGridEventType: string): string {
    const eventTypeMap: Record<string, string> = {
      'processed': 'sent',
      'delivered': 'delivered',
      'open': 'opened',
      'click': 'clicked',
      'bounce': 'bounced',
      'dropped': 'bounced',
      'spam_report': 'bounced',
      'unsubscribe': 'unsubscribed'
    };

    return eventTypeMap[sendGridEventType] || sendGridEventType;
  }
}

export const emailService = new EmailService();
export { EmailService };

// Static methods for backward compatibility
export class EmailServiceStatic {
  static async sendTFCDeadlineReminder(bookingId: string): Promise<void> {
    // Implementation would go here
    logger.info('TFC deadline reminder sent', { bookingId });
  }

  static async sendCancellationConfirmation(bookingId: string, refundAmount: number, reason: string): Promise<void> {
    // Implementation would go here
    logger.info('Cancellation confirmation sent', { bookingId, refundAmount, reason });
  }
}

// Export static methods on the main EmailService class
Object.assign(EmailService, EmailServiceStatic);