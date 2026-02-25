# Extreme Wordle

A full-stack, multi-mode Wordle application with six high-difficulty game modes that fundamentally alter the traditional Wordle experience through time constraints, memory challenges, deduction mechanics, and unique secondary states.

## Game Modes

| Mode | Description |
|------|-------------|
| **Speed Run** | 5-letter word, 6 guesses, 5-minute timer |
| **Twin** | Two words evaluated simultaneously, 7 guesses |
| **Colorblind** | No colour feedback — all tiles look identical, 8 guesses |
| **Flash / Memory** | Board visible 3s, then whites out for 25s. 5-minute limit |
| **Show Mercy** | Answer a dad joke correctly when you run out of guesses for +1 attempt |
| **Guess the Rest** | 6-letter words with obfuscated hex colours instead of green/yellow/grey |

## Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS 3
- **Backend**: Node.js 18, Express 4, TypeScript (strict)
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7
- **Auth**: JWT (Bearer token)

## Prerequisites

- Node.js 18 LTS
- PostgreSQL 14+
- Redis 7+

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd Extreme-Wordle
```

### 2. Set up PostgreSQL

Create the database and user:

```bash
sudo -u postgres psql -c "CREATE USER wordle_admin WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE extreme_wordle OWNER wordle_admin;"
```

Run the schema migration and seed data:

```bash
PGPASSWORD=changeme psql -U wordle_admin -h localhost -d extreme_wordle \
  -f backend/src/db/schema.sql
```

### 3. Start Redis

```bash
sudo systemctl start redis-server
```

### 4. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Configure environment (optional)

The backend uses sensible defaults for local development. To override, create `backend/.env`:

```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=wordle_admin
PG_PASSWORD=changeme
PG_DATABASE=extreme_wordle
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key
PORT=3001
NODE_ENV=development
```

### 6. Start the application

**Backend** (runs on port 3001):

```bash
cd backend
npm run dev
```

**Frontend** (runs on port 3000, proxies `/api` to backend):

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

## API Endpoints

All endpoints require a JWT Bearer token (use `POST /api/v1/auth/dev-token` for development).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/api/v1` | API info & available modes |
| `POST` | `/api/v1/auth/register` | Create account |
| `POST` | `/api/v1/auth/login` | Login & receive JWT |
| `POST` | `/api/v1/auth/dev-token` | Dev-only test JWT |
| `POST` | `/api/v1/games/start` | Start a new game `{ mode }` |
| `POST` | `/api/v1/games/:sessionId/guess` | Submit a guess `{ guess }` |
| `POST` | `/api/v1/games/:sessionId/mercy` | Request/answer mercy `{ jokeAnswer? }` |

## Project Structure

```
Extreme-Wordle/
├── backend/
│   └── src/
│       ├── config/          # Centralised env config
│       ├── controllers/     # HTTP layer + DTO mapper
│       ├── db/              # PG pool, Redis client, schema.sql
│       ├── middleware/       # Auth, validation, error handler
│       ├── models/          # Interfaces, DTOs, enums
│       ├── repositories/    # Database access (users, dictionary, stats)
│       ├── routes/          # Express route factories
│       ├── services/        # Game engine, session cache, joke service
│       ├── strategies/      # Strategy pattern: one per game mode
│       └── index.ts         # Entry point
├── frontend/
│   └── src/
│       ├── components/      # React components (HomeScreen, GameBoard, etc.)
│       ├── context/         # GameContext (reducer-based state management)
│       ├── hooks/           # useKeyboard, useTimer
│       ├── services/        # API client
│       ├── types/           # TypeScript types mirroring backend DTOs
│       ├── App.tsx          # Root component
│       └── main.tsx         # Entry point
└── docs/
    └── dev-spec.md          # Full development specification
```

## Scripts

### Backend

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start with nodemon + ts-node (hot reload) |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run compiled JS from `dist/` |

### Frontend

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Vite dev server on port 3000 |
| `build` | `npm run build` | TypeScript check + Vite production build |
| `preview` | `npm run preview` | Preview production build locally |
