# Activity Update 404 Error

## Problem
When clicking "Save" on the Edit Activity page, the system returned a `404 (Not Found)` error for the `PUT` request: `PUT /api/v1/business/activities/:id`.

## Root Cause
The backend router for business activities (`api/src/routes/businessActivities.ts`) was missing the `PUT` route handler. It only supported `GET`, `POST`, and `DELETE`, meaning any attempt to save changes to an existing activity was rejected by the server.

## Solution

### 1. New PUT Route Implementation
Added a comprehensive `router.put('/:id', ...)` handler to `api/src/routes/businessActivities.ts`.

### 2. Feature Coverage
The new route includes support for updating:
- Basic info (Title, Description, Dates)
- Pricing and Capacity
- Specialized settings for Wraparound Care (Year Groups)
- Specialized settings for Holiday Clubs (Age ranges, Discounts)
- Schedule and Excluded Dates

### 3. Ownership Verification
The route includes a security check to ensure that the business user attempting the update actually owns the venue associated with the activity being modified.

## Verification
- Clicking "Save" now returns a `200 OK` success response.
- Changes are correctly persisted to the database and visible upon refreshing the page.
