# Admin Setup Guide

## Standardized Admin Credentials

**Email:** `Admin@workrate.com`  
**Password:** `Admin1234`

## Setup Methods

### Method 1: Using Node.js Script (Recommended)

```bash
cd workrate-api
npm run setup-admin
```

**Requirements:**
- `DATABASE_URL` must be set in `.env` file
- Database must be accessible

### Method 2: Using SQL Script

```bash
psql -d workrate -f sql/setup-admin.sql
```

### Method 3: Generate SQL and Run Manually

```bash
cd workrate-api
node scripts/generate-admin-sql.js
```

Copy the generated SQL and run it in your PostgreSQL database.

## Admin Dashboard Features

### Platform Stats
- **Total Users** - Active (non-suspended) users
- **Total Sessions** - All sessions tracked
- **Total Minutes** - Verified minutes across all sessions
- **Total Hours** - Verified hours (formatted)
- **Revenue** - Monthly recurring revenue (MRR) from Pro ($19/mo) and Agency ($49/mo) plans
- **Plan Breakdown** - Users by plan (Free, Pro, Agency)

### Filters
- **Date Range** - Filter stats by start and end date
- **User Search** - Search users by email or name
- **Plan Filter** - Filter by Free, Pro, or Agency
- **Status Filter** - Filter by Active or Suspended

### User Management
- View all users with pagination
- See verified minutes and hours per user
- Suspend/Reactivate users
- Change user plans
- Grant/Revoke admin access
- Export user data to CSV

### Export
- Export all user data to CSV
- Includes: Email, Name, Plan, Status, Sessions, Verified Minutes/Hours, Join Date

## Access Admin Dashboard

1. Navigate to `/admin` on your deployed site
2. Login with:
   - Email: `Admin@workrate.com`
   - Password: `Admin1234`

## Notes

- Admin email is case-insensitive (Admin@workrate.com = admin@workrate.com)
- Admin user is automatically set to Agency plan
- Admin cannot remove their own admin status
- Revenue calculation is based on monthly subscriptions, not hourly rates
