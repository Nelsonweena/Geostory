# Geostory

![Geostory homepage](/public/ReadMeImages/homepage.png)

Geostory is an interactive travel-memory web app that turns saved places into a personal story map. Users can mark locations on a MapLibre globe, attach memories with dates, moods, tags, and photos, browse everything through a searchable memory feed, and generate an AI-written trip story from their journey.

This project was built as a portfolio piece to demonstrate frontend architecture, map interaction design, persistent user data, and AI-assisted storytelling in a modern Next.js application.

## Key Features

### Interactive story map

![interactive story map](/public/ReadMeImages/interactivestorymap.png)

- Displays an immersive MapLibre map powered by MapTiler tiles.
- Lets users fly to saved places, inspect popups, and open location-specific memory panels.
- Uses the map as the main storytelling canvas, turning travel memories into a visual journey.

### Location pinning

![pinning](/public/ReadMeImages/pinning.png)

- Users can save places by selecting an existing map location, searching for a real-world place, or clicking directly on the map.
- Location search and reverse geocoding use OpenStreetMap/Nominatim data.
- Saved locations are stored per user in Firebase Firestore.

### Memory journaling

![memoryjournal](/public/ReadMeImages/memoryjournal.png)

- Each marked location can contain multiple memories.
- Memories support titles, descriptions, dates, times, moods, tags, and photo attachments.
- Photos are stored locally in IndexedDB so memories can include rich visual context without requiring cloud file upload setup.
- Users can edit, delete, and clear memories from the memory panel.

### Memory feed and filtering

![memoryfeed](/public/ReadMeImages/memoryfeed.png)

- A dedicated memory feed collects memories from all saved places.
- Users can search by title, description, place, tag, mood, or date.
- Filter controls help narrow memories by country, tag, mood, and date.
- Selecting a memory can bring the user back to the related place on the globe.

### Visual mode

![visualmode](/public/ReadMeImages/visualmode.png)

- Visual mode turns the map into a journey playback experience.
- Memories are grouped into timeline items by date/month.
- Users can scrub through the journey, play/pause the timeline, restart it, and repeat the animation.
- Animated route lines highlight movement between memory locations.

### AI trip story generation

![AI](/public/ReadMeImages/AI.png)

- The app includes an API route that sends chronological memories and locations to Gemini.
- Gemini returns a cinematic travel summary split into place-based story sections.
- The generated story appears inside the visual mode panel, turning map data into a readable travel narrative.

### Authentication and persistence

![authentication](/public/ReadMeImages/authentication.png)

- Firebase Authentication supports email/password accounts and Google sign-in.
- User account metadata is saved to Firestore.
- Marked locations and memories are scoped to the authenticated user.
- Zustand stores manage client-side map, settings, location, and memory state.

## Tech Stack

| Area | Tools |
| --- | --- |
| Framework | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Mapping | MapLibre GL, react-map-gl, MapTiler |
| State Management | Zustand |
| Data & Auth | Firebase Authentication, Firebase Firestore |
| AI | Google Gemini via `@google/genai` |
| Geocoding | OpenStreetMap/Nominatim |
| Tooling | ESLint, Prettier, Husky, lint-staged |

## Project Structure

```txt
src/
  backend/
    db/                 Mock location and memory data
    services/           Backend memory service helpers
  frontend/
    components/         UI, layout, memory, globe, and visual-mode components
    hooks/              Reusable frontend hooks
    services/           Firebase configuration helpers
  map/
    Layers/             MapLibre data sources and custom layers
    Markers/            Marker and clustering components
    Popups/             Map popup UI
    MapContainer.tsx    Main interactive map experience
  pages/
    api/                Next.js API routes, including AI trip-story generation
    index.tsx           Landing page
    login.tsx           Authentication page
    map.tsx             Main app route
  shared/
    constants/          App configuration
    types/              Shared TypeScript models
  store/                Zustand state stores
  theme/                Global styles and icon collection
```

## Getting Started

Follow these steps to run Geostory locally.

### 1. Clone the repository

```bash
git clone https://github.com/your-username/geostory.git
cd geostory
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create an environment file

Create a `.env.local` file in the root of the project.

```env
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_key

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

GEMINI_API_KEY=your_gemini_api_key
GEMINI_TRIP_STORY_MODEL=gemini-2.5-flash
```

### 4. Run the development server

```bash
npm run dev
```

Then open:

```txt
http://localhost:3000
```

## Available Scripts

```bash
npm run dev          # Start the local development server
npm run build        # Create a production build
npm run start        # Run the production build
npm run lint         # Run linting
npm run lint-staged  # Run staged-file checks
```