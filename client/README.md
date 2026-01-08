# E-Commerce Admin Dashboard (Frontend)

## Project Overview
This frontend is a React-based admin dashboard for an e-commerce system. It focuses on a clean UI first, with API-ready data flow. The current implementation uses dummy data and mock services so you can work on UI and UX without a backend.

## Tech Stack
- React (JavaScript)
- React Router v6
- Vite
- Plain CSS

## Folder Structure (Brief)
```
src/
  api/           // Service layer (API-ready)
  auth/          // Auth context and helpers
  components/    // Reusable UI components
  data/          // Dummy data (fallback)
  hooks/         // Custom hooks (page data orchestration)
  pages/         // Page-level views
  routes/        // Route guards
  utils/         // Small utilities (formatters, etc.)
  App.jsx        // Routes and layout
  main.jsx       // Entry point
```

## How to Run the Frontend
From the `client/` folder:
```
pnpm install
pnpm dev
```

If you use a real API, set:
```
VITE_API_BASE_URL=http://localhost:3001/api
```

## Data Flow (Simple)
```
Page → Hook → Service → (API or Dummy Data)
```
Pages only handle UI state. Services decide whether to call the API or fall back to dummy data.

## Role-Based UI (Admin vs Staff)
- **Admin**: full UI access (add/edit/delete, status updates, toggles).
- **Staff**: read-only UI (buttons are disabled).

## Notes
- Dummy data is the fallback if the API is unavailable.
- UI text and layout are stable; API integration can be added later without refactoring the UI.
