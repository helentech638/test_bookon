# Venue Fetch 404 in Edit Activity

## Problem
On the "Edit Activity" page, the "Venue" dropdown remained empty, and the browser console showed a `404 (Not Found)` error for the URL: `http://localhost:3000/api/v1/business/venue-setup`.

## Root Cause
The frontend was incorrectly calling a page route (`/business/venue-setup`) instead of the actual API data endpoint (`/business/venues`) to fetch the list of available locations.

## Solution

### 1. Correct Endpoint Mapping
Updated `frontend/src/pages/Business/EditActivityPage.tsx`:
- Before: `fetch(buildApiUrl('/business/venue-setup'))`
- After: `fetch(buildApiUrl('/business/venues'))`

### 2. Standardization
Applied the same fix to `CreateActivityPage.tsx` to ensure new activity creation also uses the standardized `/business/venues` data endpoint.

### 3. Nested Data Parsing
Updated the data extraction logic to handle cases where the API returns the venue list inside a nested `data.venues` or `data.data` field, making the component more resilient to backend response changes.

## Verification
- The "Venue" dropdown now correctly displays all venues owned by the business.
- No 404 errors appear when visiting the Edit or Create Activity pages.
