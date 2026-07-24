# Project: Mobile App Feature Parity

## Architecture
- Mobile App: React Native / Expo application (`c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\App`)
- Website Reference: Next.js / Web application (`c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE`)

## Key Requirements & Scope
- **R1: Google Sheets Synchronization**: Sync inventory changes automatically to Google Sheets via existing webhook URL and Apps Script payload structure.
- **R2: Excel Export System**: Generate `.xlsx` multi-worksheet formatted workbooks using the website's Excel library.
- **R3: Tag Management**: Admin interface to create, edit, delete tags and set permission inheritance (Board -> Admin -> Inventory -> Media).
- **R4: Social Links Management**: Admin section to manage Instagram, LinkedIn, GitHub, YouTube links.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 0 | Codebase Exploration | Analyze Website and App implementations | none | IN_PROGRESS | TBD |
| 1 | Google Sheets Sync (R1) | Mobile App Webhook Sync on Inventory Edits | M0 | PLANNED | TBD |
| 2 | Excel Export (R2) | Mobile App XLSX Export with Worksheets & Formatting | M0 | PLANNED | TBD |
| 3 | Tag Management (R3) | Admin UI for Tags & Permission Inheritance | M0 | PLANNED | TBD |
| 4 | Social Links (R4) | Admin UI for Social Links | M0 | PLANNED | TBD |
| 5 | Unit Testing & E2E Gate | Verify all tests pass for R1-R4 + Forensic Audit | M1-M4 | PLANNED | TBD |

## Interface Contracts & Guidelines
- Expo Versioning: Adhere to Expo v57.0.0 standards per user rule (`https://docs.expo.dev/versions/v57.0.0/`).
- Webhook URL & Payload: Must match Website implementation.
- Excel Library: Must match Website library (e.g. `xlsx` or `exceljs`).
- Backend Service: Existing APIs in Mobile App backend / Website API routes to be leveraged.

## Code Layout
- Mobile App root: `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\App`
- Website root: `c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE`
