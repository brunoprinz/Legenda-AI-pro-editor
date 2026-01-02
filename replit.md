# LegendaAI Pro Editor

## Overview
A video subtitle/legend editor application built with React and Vite. The app allows users to upload videos, add and manage subtitles, customize subtitle styling, and export videos with embedded subtitles.

## Project Architecture
- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (via CDN)
- **Video Processing**: mp4-muxer for video export
- **AI Integration**: Google Gemini API for AI-powered features

## Project Structure
```
/
├── App.tsx           # Main application component
├── index.tsx         # React entry point
├── index.html        # HTML template
├── types.ts          # TypeScript type definitions
├── vite.config.ts    # Vite configuration
├── components/
│   └── Timeline.tsx  # Video timeline component
├── services/
│   ├── exportService.ts  # Video export functionality
│   └── geminiService.ts  # Google Gemini AI integration
```

## Development
- Run `npm run dev` to start the development server on port 5000
- Run `npm run build` to create a production build
- Run `npm run preview` to preview the production build

## Environment Variables
- `GEMINI_API_KEY`: Google Gemini API key for AI features

## Deployment
- Deployment type: Static
- Build command: `npm run build`
- Public directory: `dist`

## Recent Changes
- 2026-01-02: Initial setup for Replit environment
  - Configured Vite to use port 5000 with host 0.0.0.0
  - Enabled allowedHosts for Replit proxy compatibility
  - Set up deployment configuration for static hosting
