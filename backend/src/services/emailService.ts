import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

interface EmailData {
  to: string;
  toName: string;
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
        to: emailData.to,
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