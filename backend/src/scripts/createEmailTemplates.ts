import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const emailTemplates = [
  {
    name: 'Booking Confirmation',
    trigger: 'booking-confirmation',
    subjectTemplate: 'Booking Confirmed - {{activityName}} for {{childName}}',
    bodyHtmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00806a;">Booking Confirmed!</h2>
        
        <p>Hi {{parentName}},</p>
        
        <p>Great news! Your booking has been confirmed for <strong>{{childName}}</strong>.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
          <p><strong>Activity:</strong> {{activityName}}</p>
          <p><strong>Venue:</strong> {{venueName}}</p>
          <p><strong>Address:</strong> {{venueAddress}}</p>
          <p><strong>Date:</strong> {{bookingDate}}</p>
          <p><strong>Time:</strong> {{bookingTime}}</p>
          <p><strong>Amount:</strong> {{amount}}</p>
          <p><strong>Booking Reference:</strong> {{bookingNumber}}</p>
        </div>
        
        <p>Please arrive 10 minutes before the start time. If you have any questions, please contact us.</p>
        
        <p>Thank you for choosing BookOn!</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This email was sent to {{parentName}} regarding booking {{bookingNumber}}.
        </p>
      </div>
    `,
    bodyTextTemplate: `
      Booking Confirmed!
      
      Hi {{parentName}},
      
      Great news! Your booking has been confirmed for {{childName}}.
      
      Booking Details:
      - Activity: {{activityName}}
      - Venue: {{venueName}}
      - Address: {{venueAddress}}
      - Date: {{bookingDate}}
      - Time: {{bookingTime}}
      - Amount: {{amount}}
      - Booking Reference: {{bookingNumber}}
      
      Please arrive 10 minutes before the start time. If you have any questions, please contact us.
      
      Thank you for choosing BookOn!
    `,
    placeholders: ['parentName', 'childName', 'activityName', 'venueName', 'venueAddress', 'bookingDate', 'bookingTime', 'amount', 'bookingNumber'],
    active: true
  },
  {
    name: 'TFC Payment Instructions',
    trigger: 'tfc-instructions',
    subjectTemplate: 'Tax-Free Childcare Payment Required - {{activityName}}',
    bodyHtmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00806a;">Tax-Free Childcare Payment Required</h2>
        
        <p>Hi {{parentName}},</p>
        
        <p>Your booking for <strong>{{childName}}</strong> is reserved pending payment via Tax-Free Childcare.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin-top: 0; color: #856404;">Payment Required</h3>
          <p><strong>Amount:</strong> {{amount}}</p>
          <p><strong>Payment Reference:</strong> <code style="background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px;">{{paymentReference}}</code></p>
          <p><strong>Deadline:</strong> {{deadline}}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
          <p><strong>Activity:</strong> {{activityName}}</p>
          <p><strong>Venue:</strong> {{venueName}}</p>
          <p><strong>Date:</strong> {{bookingDate}}</p>
          <p><strong>Time:</strong> {{bookingTime}}</p>
        </div>
        
        <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0066cc;">How to Pay</h3>
          <ol>
            <li>Log into your Tax-Free Childcare account at <a href="https://www.gov.uk/apply-tax-free-childcare">gov.uk/apply-tax-free-childcare</a></li>
            <li>Make a payment using the reference: <strong>{{paymentReference}}</strong></li>
            <li>Your booking will be confirmed automatically once payment is received</li>
          </ol>
        </div>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #721c24;"><strong>Important:</strong> {{tfcInstructions}}</p>
        </div>
        
        <p>If you have any questions, please contact us immediately.</p>
        
        <p>Thank you for choosing BookOn!</p>
      </div>
    `,
    bodyTextTemplate: `
      Tax-Free Childcare Payment Required
      
      Hi {{parentName}},
      
      Your booking for {{childName}} is reserved pending payment via Tax-Free Childcare.
      
      Payment Required:
      - Amount: {{amount}}
      - Payment Reference: {{paymentReference}}
      - Deadline: {{deadline}}
      
      Booking Details:
      - Activity: {{activityName}}
      - Venue: {{venueName}}
      - Date: {{bookingDate}}
      - Time: {{bookingTime}}
      
      How to Pay:
      1. Log into your Tax-Free Childcare account at gov.uk/apply-tax-free-childcare
      2. Make a payment using the reference: {{paymentReference}}
      3. Your booking will be confirmed automatically once payment is received
      
      Important: {{tfcInstructions}}
      
      If you have any questions, please contact us immediately.
      
      Thank you for choosing BookOn!
    `,
    placeholders: ['parentName', 'childName', 'activityName', 'venueName', 'bookingDate', 'bookingTime', 'amount', 'paymentReference', 'deadline', 'tfcInstructions'],
    active: true
  },
  {
    name: 'Cancellation Confirmation',
    trigger: 'cancellation-confirmation',
    subjectTemplate: 'Booking Cancelled - {{activityName}}',
    bodyHtmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Booking Cancelled</h2>
        
        <p>Hi {{parentName}},</p>
        
        <p>Your booking for <strong>{{childName}}</strong> has been cancelled as requested.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Cancelled Booking Details</h3>
          <p><strong>Activity:</strong> {{activityName}}</p>
          <p><strong>Venue:</strong> {{venueName}}</p>
          <p><strong>Date:</strong> {{bookingDate}}</p>
          <p><strong>Time:</strong> {{bookingTime}}</p>
        </div>
        
        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #155724;">Refund Information</h3>
          <p><strong>Refund Amount:</strong> {{refundAmount}}</p>
          <p><strong>Refund Method:</strong> {{refundMethod}}</p>
        </div>
        
        <p>If you have any questions about this cancellation or refund, please contact us.</p>
        
        <p>Thank you for choosing BookOn!</p>
      </div>
    `,
    bodyTextTemplate: `
      Booking Cancelled
      
      Hi {{parentName}},
      
      Your booking for {{childName}} has been cancelled as requested.
      
      Cancelled Booking Details:
      - Activity: {{activityName}}
      - Venue: {{venueName}}
      - Date: {{bookingDate}}
      - Time: {{bookingTime}}
      
      Refund Information:
      - Refund Amount: {{refundAmount}}
      - Refund Method: {{refundMethod}}
      
      If you have any questions about this cancellation or refund, please contact us.
      
      Thank you for choosing BookOn!
    `,
    placeholders: ['parentName', 'childName', 'activityName', 'venueName', 'bookingDate', 'bookingTime', 'refundAmount', 'refundMethod'],
    active: true
  },
  {
    name: 'TFC Deadline Reminder',
    trigger: 'tfc-reminder',
    subjectTemplate: 'Payment Deadline Approaching - {{deadline}}',
    bodyHtmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Payment Deadline Approaching</h2>
        
        <p>Hi {{parentName}},</p>
        
        <p>This is a reminder that your Tax-Free Childcare payment for <strong>{{childName}}</strong>'s booking is due soon.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin-top: 0; color: #856404;">Payment Due</h3>
          <p><strong>Amount:</strong> {{amount}}</p>
          <p><strong>Payment Reference:</strong> <code style="background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px;">{{paymentReference}}</code></p>
          <p><strong>Deadline:</strong> {{deadline}}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
          <p><strong>Activity:</strong> {{activityName}}</p>
          <p><strong>Venue:</strong> {{venueName}}</p>
          <p><strong>Date:</strong> {{bookingDate}}</p>
          <p><strong>Time:</strong> {{bookingTime}}</p>
        </div>
        
        <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0066cc;">How to Pay</h3>
          <ol>
            <li>Log into your Tax-Free Childcare account at <a href="https://www.gov.uk/apply-tax-free-childcare">gov.uk/apply-tax-free-childcare</a></li>
            <li>Make a payment using the reference: <strong>{{paymentReference}}</strong></li>
            <li>Your booking will be confirmed automatically once payment is received</li>
          </ol>
        </div>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #721c24;"><strong>Important:</strong> If payment is not received by the deadline, your booking will be automatically cancelled and the space will be released.</p>
        </div>
        
        <p>Please make your payment as soon as possible to secure your booking.</p>
        
        <p>Thank you for choosing BookOn!</p>
      </div>
    `,
    bodyTextTemplate: `
      Payment Deadline Approaching
      
      Hi {{parentName}},
      
      This is a reminder that your Tax-Free Childcare payment for {{childName}}'s booking is due soon.
      
      Payment Due:
      - Amount: {{amount}}
      - Payment Reference: {{paymentReference}}
      - Deadline: {{deadline}}
      
      Booking Details:
      - Activity: {{activityName}}
      - Venue: {{venueName}}
      - Date: {{bookingDate}}
      - Time: {{bookingTime}}
      
      How to Pay:
      1. Log into your Tax-Free Childcare account at gov.uk/apply-tax-free-childcare
      2. Make a payment using the reference: {{paymentReference}}
      3. Your booking will be confirmed automatically once payment is received
      
      Important: If payment is not received by the deadline, your booking will be automatically cancelled and the space will be released.
      
      Please make your payment as soon as possible to secure your booking.
      
      Thank you for choosing BookOn!
    `,
    placeholders: ['parentName', 'childName', 'activityName', 'venueName', 'bookingDate', 'bookingTime', 'amount', 'paymentReference', 'deadline'],
    active: true
  },
  {
    name: 'Credit Expiry Reminder',
    trigger: 'credit-expiry-reminder',
    subjectTemplate: 'Credit Expiring Soon - {{expiryDate}}',
    bodyHtmlTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Credit Expiring Soon</h2>
        
        <p>Hi {{parentName}},</p>
        
        <p>This is a friendly reminder that you have credit in your BookOn wallet that will expire soon.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin-top: 0; color: #856404;">Credit Details</h3>
          <p><strong>Amount:</strong> {{creditAmount}}</p>
          <p><strong>Expires:</strong> {{expiryDate}}</p>
        </div>
        
        <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0066cc;">How to Use Your Credit</h3>
          <ol>
            <li>Browse available activities on BookOn</li>
            <li>Select an activity and proceed to checkout</li>
            <li>Choose to use your wallet credit</li>
            <li>Complete your booking</li>
          </ol>
        </div>
        
        <p>Don't let your credit go to waste! Book an activity today to make the most of your credit.</p>
        
        <p>Thank you for choosing BookOn!</p>
      </div>
    `,
    bodyTextTemplate: `
      Credit Expiring Soon
      
      Hi {{parentName}},
      
      This is a friendly reminder that you have credit in your BookOn wallet that will expire soon.
      
      Credit Details:
      - Amount: {{creditAmount}}
      - Expires: {{expiryDate}}
      
      How to Use Your Credit:
      1. Browse available activities on BookOn
      2. Select an activity and proceed to checkout
      3. Choose to use your wallet credit
      4. Complete your booking
      
      Don't let your credit go to waste! Book an activity today to make the most of your credit.
      
      Thank you for choosing BookOn!
    `,
    placeholders: ['parentName', 'creditAmount', 'expiryDate'],
    active: true
  }
];

export async function createEmailTemplates() {
  try {
    logger.info('Creating email templates...');

    for (const template of emailTemplates) {
      // Check if template already exists
      const existingTemplate = await prisma.emailTemplate.findFirst({
        where: { trigger: template.trigger }
      });

      if (existingTemplate) {
        logger.info(`Template ${template.trigger} already exists, skipping...`);
        continue;
      }

      // Create template
      await prisma.emailTemplate.create({
        data: {
          name: template.name,
          trigger: template.trigger,
          subjectTemplate: template.subjectTemplate,
          bodyHtmlTemplate: template.bodyHtmlTemplate,
          bodyTextTemplate: template.bodyTextTemplate,
          active: template.active,
          placeholders: template.placeholders,
          createdBy: 'system' // You might want to use an actual admin user ID
        }
      });

      logger.info(`Created email template: ${template.trigger}`);
    }

    logger.info('Email templates created successfully');
  } catch (error) {
    logger.error('Error creating email templates:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createEmailTemplates()
    .then(() => {
      logger.info('Email templates creation completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Email templates creation failed:', error);
      process.exit(1);
    });
}

