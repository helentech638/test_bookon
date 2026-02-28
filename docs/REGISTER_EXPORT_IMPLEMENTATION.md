# Register Export Implementation

## Overview
Added comprehensive register export functionality to the business dashboard that allows providers to export course registers in multiple formats with all dates included.

## Features Implemented

### 1. Export Formats Supported
- **CSV** - Comma-separated values for spreadsheet import
- **Excel** - Excel-compatible format (.xls)
- **PDF** - Formatted PDF with tables and layout

### 2. Export Endpoint
**Location**: `backend/src/routes/registers.ts`  
**Route**: `GET /api/registers/export-course/:activityId?format=csv|excel|pdf`

**What it exports**:
- All registers for a course/activity
- All dates for the course
- Complete attendance records
- Child information (name, DOB, year group, school, class)
- Parent contact information (name, email, phone)
- Medical information (allergies, medical info)
- Attendance status and check-in/out times
- Notes and special instructions

### 3. UI Integration
**Location**: `frontend/src/pages/Business/RegisterDetailPage.tsx`

**Export buttons added**:
- CSV export button
- Excel export button  
- PDF export button

**Desktop layout**:
- Full buttons with labels in the header section
- Positioned next to the back button

**Mobile layout**:
- Icon-only buttons for space efficiency
- Located in the top right of the header

## Usage

### For Providers

1. Navigate to the register detail page for any activity
2. Click the export button of your choice (CSV, Excel, or PDF)
3. The file will download automatically with all course dates included
4. Open the file in your preferred application

### Export Process

1. User clicks export button
2. Frontend calls: `/api/registers/export-course/{activityId}?format={format}`
3. Backend queries all registers for that activity
4. Backend formats data according to selected format
5. Backend returns file with appropriate headers
6. Browser downloads the file

## Data Included in Export

Each row in the export represents one child's attendance for one date, including:

1. **Date & Time**:
   - Activity date
   - Session start/end time

2. **Child Information**:
   - First and last name
   - Date of birth
   - Year group
   - School
   - Class

3. **Attendance Data**:
   - Present/absent status
   - Check-in time (if present)
   - Check-out time (if applicable)
   - Notes

4. **Parent Contact**:
   - Parent name
   - Email address
   - Phone number

5. **Medical Information**:
   - Allergies
   - Medical information/notes

## Files Modified

### Backend
1. **`backend/src/routes/registers.ts`**
   - Added `export-course` endpoint
   - Supports CSV, Excel, and PDF formats
   - Includes comprehensive data from all registers for a course

### Frontend
2. **`frontend/src/pages/Business/RegisterDetailPage.tsx`**
   - Added export function
   - Added export buttons to desktop layout
   - Added export icons to mobile layout
   - Added proper TypeScript typing

## Technical Details

### CSV/Excel Format
- Headers: Date, Session Time, Child Name, Parent Name, Email, Phone, Present, Check In, Check Out, DOB, Year Group, School, Class, Allergies, Medical Info, Notes
- Data rows include all dates for the course
- Properly escaped commas and quotes

### PDF Format
- Formatted with PDFKit
- Course information at the top
- Each date gets its own page/section
- Table format with readable layout
- Includes venue information

### Authentication
- Requires authentication token
- Only returns registers for activities owned by the business user

## Benefits

1. **Comprehensive Records**: All course dates in one file
2. **Multiple Formats**: Choose the format that works best for your needs
3. **Complete Data**: All attendance, contact, and medical information included
4. **Easy Access**: One-click export from the register page
5. **Mobile Friendly**: Works on mobile and desktop devices

## Example Export File Names

- `course_registers_{activityId}_2024-01-15.csv`
- `course_registers_{activityId}_2024-01-15.xls`
- `course_registers_{activityId}_2024-01-15.pdf`

## Testing Checklist

- [ ] CSV export works and opens in Excel
- [ ] Excel export works and opens in Excel
- [ ] PDF export works and opens in PDF viewer
- [ ] All course dates included in export
- [ ] All child information included
- [ ] All parent contact information included
- [ ] Attendance status correct
- [ ] Mobile export buttons work
- [ ] Desktop export buttons work
- [ ] File downloads successfully
- [ ] Proper authentication required

## Future Enhancements (Optional)

1. Add filtering by date range
2. Add options to include/exclude certain fields
3. Add email export functionality
4. Add scheduling for automatic exports
5. Add export templates
6. Add data visualization in PDF


