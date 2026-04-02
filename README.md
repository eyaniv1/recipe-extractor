# Recipe Video Extractor MVP

A minimal web prototype to extract recipe data from video links (YouTube, Instagram, Facebook).

## Setup

1. Install deps
   - `cd server && npm install`
   - `cd client && npm install`
2. Run development servers
   - `cd server && npm start`
   - `cd client && npm run dev`
3. Open browser at `http://localhost:5173`

## Environment

Copy `.env.example` to `.env` in server folder.

- `YOUTUBE_API_KEY` (optional, recommended)

## Supported input

- YouTube URL
- Instagram URL
- Facebook URL

## Architecture

- Backend: Express, receives URL, chooses extractor, parses text, returns JSON.
- Frontend: React + Vite, mobile-friendly, shows extracted recipe.

## Deploy to internet

- Option 1: Vercel (use monorepo with serverless functions or both apps separately).
- Option 2: Heroku / Render for server and Netlify/Vercel for frontend.

## Notes

- Instagram/Facebook scrapes may be limited by platform restrictions; use official APIs where possible.
