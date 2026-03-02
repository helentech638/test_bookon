# API Timeout and AbortError

## Problem
Page loads for "Venue Setup" and "Venues" would hang for 15-30 seconds and then crash with a console error: `AbortError: signal is aborted without reason`.

## Root Cause
The frontend was configured with a strict 15-second timeout using `AbortController`. However, the local backend was taking longer than 15 seconds to establish a connection with the Supabase cloud database because it lacked optimized connection parameters (PGBouncer and SSL).

## Solution

### 1. Backend Optimization
Normalizing the database connection URL in `api/src/utils/prisma.ts` reduced the "cold start" latency for Prisma queries. We added:
- `pgbouncer=true`: To handle connection pooling correctly.
- `sslmode=require`: To prevent the database from rejecting unencrypted local requests.
- `prepared=false`: To avoid "prepared statement" errors common with Supabase.

### 2. Frontend Timeout Extension
Increased the default timeout from 15 seconds to 60 seconds in `VenueSetupPage.tsx` and `VenuesPage.tsx`. This gives the system enough time to "wake up" the database connection on the first request without crashing the user interface.

### 3. Error Handling
Updated the fetch logic to properly parse and display backend error messages instead of showing a generic "AbortError".

## Verification
- Pages now load successfully even if the database takes a few seconds to respond.
- The `AbortError` no longer appears in the browser console.
