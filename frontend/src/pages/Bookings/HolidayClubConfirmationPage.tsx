import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Layout from '../../components/layout/Layout';
import { 
  Calendar,
  MapPin,
  Clock,
  Users,
  Download,
  Share
} from 'lucide-react';
import { 
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

interface BookingItem {
  childId: string;
  childName: string;
  date: string;
  timeSlot: string;
  price: number;
}

interface Activity {
  id: string;
  title: string;
  venue: {
    name: string;
    address: string;
  };
  startDate: string;
  endDate: string;
  whatToBring?: string;
}

const HolidayClubConfirmationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { activity, bookingItems, total, paymentMethod } = location.state || {};
  const [showCalendarInstructions, setShowCalendarInstructions] = useState(false);

  if (!activity || !bookingItems || bookingItems.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No booking data found</h2>
              <Button onClick={() => navigate('/activities')}>
                Back to Activities
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const generateCalendarEvent = () => {
    const uniqueDates = [...new Set(bookingItems.map((item: BookingItem) => item.date))] as string[];
    const startDate = new Date(Math.min(...uniqueDates.map((d: string) => new Date(d).getTime())));
    const endDate = new Date(Math.max(...uniqueDates.map((d: string) => new Date(d).getTime())));
    
    const title = `${activity.title} - Holiday Club`;
    const details = `Holiday Club booking for ${bookingItems.length} session${bookingItems.length !== 1 ? 's' : ''}\n\nVenue: ${activity.venue.name}\nAddress: ${activity.venue.address}\n\nWhat to bring: ${activity.whatToBring || 'See activity details'}`;
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(activity.venue.address)}`;
    
    window.open(calendarUrl, '_blank');
  };

  const shareBooking = () => {
    if (navigator.share) {
      navigator.share({
        title: `${activity.title} Booking Confirmation`,
        text: `I've booked ${bookingItems.length} session${bookingItems.length !== 1 ? 's' : ''} for ${activity.title} Holiday Club!`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${activity.title} Booking Confirmation - ${bookingItems.length} session${bookingItems.length !== 1 ? 's' : ''} booked!`);
      alert('Booking details copied to clipboard!');
    }
  };

  const groupBookingsByChild = () => {
    const grouped: { [key: string]: BookingItem[] } = {};
    bookingItems.forEach((item: BookingItem) => {
      if (!grouped[item.childId]) {
        grouped[item.childId] = [];
      }
      grouped[item.childId].push(item);
    });
    return grouped;
  };

  const groupedBookings = groupBookingsByChild();

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600">
              Your Holiday Club booking has been successfully confirmed
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Booking Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Activity Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{activity.title}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span>{activity.venue.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(activity.startDate).toLocaleDateString()} - {new Date(activity.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {activity.whatToBring && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-2">What to Bring:</h4>
                        <p className="text-blue-800">{activity.whatToBring}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Booking Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groupedBookings).map(([childId, childBookings]) => (
                      <div key={childId} className="border rounded-lg p-4">
                        <h4 className="font-semibold text-lg mb-3">{childBookings[0].childName}</h4>
                        <div className="space-y-2">
                          {childBookings.map((booking, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                              <div>
                                <div className="font-medium">
                                  {new Date(booking.date).toLocaleDateString('en-GB', { 
                                    weekday: 'long', 
                                    day: 'numeric', 
                                    month: 'long' 
                                  })}
                                </div>
                                <div className="text-sm text-gray-600 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {booking.timeSlot}
                                </div>
                              </div>
                              <div className="font-medium">£{booking.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Sessions:</span>
                      <span>{bookingItems.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-semibold">£{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <span className="capitalize">{paymentMethod === 'tfc' ? 'Tax-Free Childcare' : 'Card Payment'}</span>
                    </div>
                    
                    {paymentMethod === 'tfc' && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="text-yellow-600">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="text-sm text-yellow-800">
                            <p className="font-medium mb-1">Tax-Free Childcare Payment Pending</p>
                            <p>Your booking is confirmed but payment is pending. You'll receive payment instructions via email. Please complete payment within 5 days to secure your places.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      className="w-full"
                      onClick={generateCalendarEvent}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Add to Calendar
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={shareBooking}
                    >
                      <Share className="h-4 w-4 mr-2" />
                      Share Booking
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/bookings')}
                    >
                      View All Bookings
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/activities')}
                    >
                      Book More Activities
                    </Button>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-gray-900 mb-3">Need Help?</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>• Check your email for confirmation details</p>
                      <p>• Contact the venue for any questions</p>
                      <p>• View your bookings in the dashboard</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HolidayClubConfirmationPage;
