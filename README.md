# Moodly Backend

Backend API for the Moodly mood tracking app, providing secure data storage, analytics, and automated features.

## Technologies

- TypeScript
- Vercel (serverless deployment)
- Supabase (PostgreSQL database)
- Node.js

## Features

- Secure authentication with master password
- CRUD operations for mood entries
- Advanced analytics and insights generation
- Location search and geocoding
- Automated email reports via cron jobs
- User settings management
- CORS-enabled API endpoints

## Setup

1. `npm install`
2. Set environment variables:
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_KEY` - Supabase anon key
   - `MASTER_PASSWORD` - Master password for authentication
   - `SMTP_USER` - SMTP username for email
   - `SMTP_PASS` - SMTP password for email
   - `GEOAPIFY_API_KEY` - API key for Geoapify location services
3. Deploy to Vercel or run locally with `vercel dev`

## API Endpoints

### Entries

- `GET /api/get-entries` - Retrieve all mood entries
- `POST /api/save-entry` - Save or update a mood entry
- `DELETE /api/delete-entry` - Delete a specific entry

### Analytics

- `GET /api/get-analytics` - Get advanced insights and patterns

### Location

- `GET /api/search-location` - Search for locations by query

### Authentication

- `POST /api/verify-password` - Verify master password

### Settings

- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update user settings

### Cron Jobs

- `GET /api/cron/send-emails` - Send automated email reports (called by Vercel cron)
