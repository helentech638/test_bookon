require('dotenv').config();
const { emailService } = require('./dist/services/emailService');

async function testPremiumTemplatesSimple() {
  console.log('🎨 Testing Premium Email Templates (Simple Version)...');
  console.log('📧 Sending to: sakhawataliryk21@gmail.com');
  
  try {
    // Test 1: Premium Booking Confirmation with Venue Contacts
    console.log('\n📧 Test 1: Premium Booking Confirmation...');
    const bookingResult = await emailService.sendBookingConfirmation({
      to: 'sakhawataliryk21@gmail.com',
      parentName: 'Sarah Johnson',
      childName: 'Emma Johnson',
      activityName: 'Swimming Lessons',
      venueName: 'Aqua Sports Center',
      venueAddress: '123 Water Street, London, SW1A 1AA',
      venuePhone: '+44 20 7123 4567',
      venueEmail: 'info@aquasportscenter.com',
      instructor: 'Coach Michael Thompson',
      activityDate: '2024-01-20',
      activityTime: '10:00 AM - 11:00 AM',
      amount: 25.00,
      paymentReference: 'PAY-TEST-001',
      bookingId: 'BK-2024-001'
    });
    
    if (bookingResult) {
      console.log('✅ Booking Confirmation sent successfully!');
    } else {
      console.log('❌ Booking Confirmation failed');
    }
    
    // Wait 3 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Different Venue Example
    console.log('\n📧 Test 2: Different Venue Example...');
    const bookingResult2 = await emailService.sendBookingConfirmation({
      to: 'sakhawataliryk21@gmail.com',
      parentName: 'Ahmed Hassan',
      childName: 'Omar Hassan',
      activityName: 'Football Training',
      venueName: 'Sports Complex Manchester',
      venueAddress: '456 Sports Avenue, Manchester, M1 2AB',
      venuePhone: '+44 161 234 5678',
      venueEmail: 'bookings@sportscomplexmanchester.co.uk',
      instructor: 'Coach David Wilson',
      activityDate: '2024-01-22',
      activityTime: '2:00 PM - 3:30 PM',
      amount: 35.00,
      paymentReference: 'PAY-TEST-002',
      bookingId: 'BK-2024-002'
    });
    
    if (bookingResult2) {
      console.log('✅ Second Booking Confirmation sent successfully!');
    } else {
      console.log('❌ Second Booking Confirmation failed');
    }
    
    console.log('\n🎉 Premium Email Templates Test Complete!');
    console.log('📧 Check sakhawataliryk21@gmail.com for:');
    console.log('   • 2x Premium Booking Confirmations (teal design)');
    console.log('   • Venue-specific contact information');
    console.log('   • Professional teal color scheme');
    console.log('   • White background content');
    
  } catch (error) {
    console.error('❌ Error testing templates:', error);
  }
}

testPremiumTemplatesSimple();
