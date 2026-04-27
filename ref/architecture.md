# Project Architecture

TireHub is a management system for tire shops, built with a Node.js/Express backend and a React/Vite frontend.

## Backend (Node.js/Express)
- **Entry Point**: `server.js`
- **Database**: SQLite (`tire_shop.db`)
- **ORM/Querying**: Raw SQL using `sqlite3` driver.
- **Middleware**: Custom authentication middleware in `middleware/auth.js`.
- **Routes**: Modular routes located in the `routes/` directory.

## Frontend (React/Vite)
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Navigation**: Sidebar-based layout defined in `src/App.jsx`.

## Data Flow
1. Frontend sends JSON requests to `/api/*` endpoints.
2. Backend processes requests, interacts with SQLite.
3. Database triggers (defined in `Database.js`) handle automatic stock updates and other side effects.
