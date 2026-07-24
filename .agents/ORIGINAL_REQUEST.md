# Original User Request

## 2026-07-24T20:49:34Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Implement feature parity for the Mobile App to match the Website's capabilities, specifically focusing on Google Sheets Synchronization, Excel Export, Tag Management, and Social Links Management.

Working directory (App): c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\App
Reference directory (Website): c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE

Integrity mode: demo

## Requirements

### R1. Google Sheets Synchronization
Implement a mechanism in the mobile app to automatically sync inventory changes to Google Sheets, matching the website's behavior. 
- You must check the website codebase to find and use the exact same webhook logic and URL.
- This includes pushing updates through the webhook to the existing Google Apps Script whenever inventory is edited from the phone.

### R2. Excel Export System
Implement an export system in the mobile app that produces proper Excel workbooks (`.xlsx`) instead of flat CSVs. 
- The exported workbooks should include multiple worksheets, formatting, tables, and appropriate column widths, matching the website's professional reports.
- You must find and use the same library that is currently used on the website for Excel generation.

### R3. Tag Management
Create an admin interface in the mobile app that allows administrators to create, edit, and delete tags, as well as define permission inheritance (e.g., Board -> Admin -> Inventory -> Media). The backend service already exists.

### R4. Social Links Management
Add a section to the admin page in the mobile app to manage social links (Instagram, LinkedIn, GitHub, YouTube).

## Acceptance Criteria

### Verification & Testing
- [ ] Agents have written basic unit tests for the new logic (webhook sync, Excel export, tag management, and social links).
- [ ] Unit tests pass successfully.

### Google Sheets Sync
- [ ] The mobile app code includes the webhook integration pointing to the same URL used by the website.
- [ ] Inventory updates trigger the webhook payload formatted correctly for the existing Google Apps Script.

### Excel Export
- [ ] The export feature produces an `.xlsx` file (not a `.csv`).
- [ ] The export includes formatting and multiple worksheets similar to the website.
- [ ] The same Excel library from the website is implemented in the mobile app.

### Admin Features
- [ ] UI exists for creating, editing, and deleting tags.
- [ ] UI exists for managing permission inheritance for tags.
- [ ] UI exists on the admin page to manage the 4 specified social links.
