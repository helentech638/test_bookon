# Fix for 403 Error on Business Bookings Page

## Problem
The business bookings page was trying to access `/api/v1/admin/bookings` which returned a 403 Forbidden error because:
1. Business users don't have admin permissions
2. The endpoint was restricted to admin/staff roles only

## Root Cause
The `BookingsPage.tsx` was incorrectly fetching from the admin endpoint:
```typescript
const response = await fetch(buildApiUrl('/admin/bookings'), {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

## Solution

### 1. Created Business Bookings Endpoint
Created a new route file: `backend/src/routes/businessBookings.ts`

**Features**:
- Filters bookings by venues owned by the business user
- Includes search functionality by activity, child, or parent name/email
- Supports pagination
- Returns booking details with activity, venue, child, and parent information
- Only accessible to business users

**Key Functionality**:
```typescript
// Get all bookings for business user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  // Check business access
  // Get user's venues
  // Filter bookings by venue ownership
  // Return paginated results
}));

// Get single booking details
router.get('/:bookingId', authenticateToken, asyncHandler(async (req, res) => {
  // Detailed booking information
}));
```

### 2. Updated Frontend to Use Correct Endpoint
Changed `BookingsPage.tsx` to use the business-specific endpoint:
```typescript
const response = await fetch(buildApiUrl('/business/bookings'), {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### 3. Registered Route in Backend
Added the route to `backend/src/index.ts`:
```typescript
import businessBookingsRoutes from './routes/businessBookings';
// ...
app.use('/api/v1/business/bookings', businessBookingsRoutes);
```

## Files Modified

1. **Created**: `backend/src/routes/businessBookings.ts`
   - New business-specific bookings endpoint
   - Proper access control for business users
   - Venue-based filtering

2. **Modified**: `frontend/src/pages/Business/BookingsPage.tsx`
   - Changed endpoint from `/admin/bookings` to `/business/bookings`

3. **Modified**: `backend/src/index.ts`
   - Imported and registered the new businessBookings route

## How It Works

1. Business user logs in and navigates to Bookings tab
2. Frontend calls `/api/v1/business/bookings`
3. Backend checks if user is a business user
4. Backend gets all venues owned by the business user
5. Backend filters bookings to only include those for the user's venues
6. Backend returns paginated booking results

## Security
- ✅ Only accessible to business users
- ✅ Bookings filtered by venue ownership
- ✅ Admin users can also access (for support purposes)
- ✅ Proper authentication required

## Additional Fixes

### Field Mapping Issue (500 Error)
The initial query was trying to access non-existent fields on the Activity model:
- ❌ `activity.date` and `activity.time` (don't exist)
- ✅ `booking.activityDate` and `booking.activityTime` (correct fields from Booking model)

**Fix Applied**:
- Use booking's own `activityDate` and `activityTime` fields
- Use booking's `totalAmount` instead of just `amount`

## Testing
The booking page should now:
- ✅ Load without 403 or 500 errors
- ✅ Show only bookings for the business user's venues
- ✅ Allow searching by activity, child, or parent
- ✅ Support pagination
- ✅ Display booking details correctly

## Endpoints Available

### GET `/api/v1/business/bookings`
Query parameters:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `status` - Filter by booking status
- `activityId` - Filter by activity
- `search` - Search by activity title, child name, or parent name/email

Response:
```json
{
  "success": true,
  "data": [...bookings...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### GET `/api/v1/business/bookings/:bookingId`
Returns detailed booking information including activity, venue, child, parent, and payment details.

## Error Handling
- Returns 403 if user doesn't have business access
- Returns 404 if booking not found or user doesn't own the venue
- Returns 500 for server errors

