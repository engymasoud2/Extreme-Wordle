# Development Specification: US2 - Advanced Wordle Game Modes

## Overview

This document specifies the development of a full-stack, multi-mode Wordle-style application. The application introduces a home screen allowing users to select from six high-difficulty, rules-altering game modes, fundamentally changing the traditional user experience through time constraints, memory challenges, deduction mechanics, and unique secondary states.

**User Story**: As a puzzle enthusiast, I want to choose from six highly challenging game modes (Speed Run, Twin, Colorblind, Flash/Memory, Show Mercy, and Guess the Rest) from a home screen so that I can test my vocabulary, deduction skills, memory, and dad-joke knowledge under extreme constraints.

**T-Shirt Size**: Large

**Rationale**: While the core game loop of Wordle is simple, introducing real-time client-side flashing, synchronized timers, multi-word linked progression, randomized state variables (colors), and external API integrations (dad jokes) significantly increases state management complexity. Building a modular game engine that can support all six modes without spaghetti code is critical for the product's maintainability.

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React SPA UI                                            │   │
│  │  - Home Screen Component (Mode Selection)                │   │
│  │  - Game Board Component (Handles Flash/Whiteout logic)   │   │
│  │  - Timer/State Component                                 │   │
│  │  - Dad Joke Modal Component                              │   │
│  └────────────────┬─────────────────────────────────────────┘   │
└─────────────────┼───────────────────────────────────────────────┘
                  │ HTTP/REST (State is purely server-side 
                  │ to prevent client-side DevTools cheating)
                  │ POST /api/v1/games/start
                  │ POST /api/v1/games/{sessionId}/guess
                  │ POST /api/v1/games/{sessionId}/mercy
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Backend Server (Node.js)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  API Routes Layer                                          │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                              │
│  ┌────────────────▼───────────────────────────────────────────┐  │
│  │  Game Engine Service                                       │  │
│  │  - initializeGame()                                        │  │
│  │  - processGuess()                                          │  │
│  │  - triggerMercyState()                                     │  │
│  │  - enforceTimers()                                         │  │
│  └────────────────┬───────────────────────┬───────────────────┘  │
│                   │                       │                      │
│  ┌────────────────┼───────────────────┐   │  ┌────────────────┐  │
│  │  Data Access Layer                 │   │  │ External APIs  │  │
│  │  - sessionCache.get/set()          │   ├──► Dad Joke API   │  │
│  │  - statsRepository.save()          │   │  └────────────────┘  │
│  │  - userRepository.get/create()     │   │                      │
│  └────────────────┬──────────────┬────┘   │                      │
└─────────────────┼──────────────┼──────────┴──────────────────────┘
                  │              │
    ┌─────────────▼────────┐     │
    │  PostgreSQL DB       │     │
    │  - users table       │     │
    │  - match_history     │     │
    │  - dictionaries      │     │
    └──────────────────────┘     │
                          ┌──────▼──────────────┐
                          │  Redis Cache        │
                          │  - active_sessions  │
                          │  - key: gameId      │
                          └─────────────────────┘
```

**Rationale**: To prevent cheating (users inspecting network tabs or local storage for the answer or color mappings), the actual word, validation logic, and "Guess the Rest" color key must live on the server. The client handles presentation, memory-flashing UI loops, and timer display, but the server acts as the ultimate source of truth.

---

## Class Diagram

```text
┌────────────────────────────────────────────────────────────────────┐
│                        GameController                              │
├────────────────────────────────────────────────────────────────────┤
│ - gameService: GameEngineService                                   │
│ - jokeService: JokeService                                         │
├────────────────────────────────────────────────────────────────────┤
│ + POST /start(req): Promise<GameSessionDTO>                        │
│ + POST /{sessionId}/guess(req): Promise<GuessResultDTO>            │
│ + POST /{sessionId}/mercy(req): Promise<MercyResultDTO>            │
└────────────────┬───────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                       GameEngineService                           │
├───────────────────────────────────────────────────────────────────┤
│ - dictionaryRepo: DictionaryRepository                            │
│ - sessionCache: SessionCacheService                               │
│ - modeStrategies: Map<Mode, IModeStrategy>                        │
├───────────────────────────────────────────────────────────────────┤
│ + initializeGame(mode: GameMode): Promise<GameSession>            │
│ + processGuess(sessionId: string, guess: string): Promise<Result> │
│ + triggerMercyState(sessionId: string): Promise<Joke>             │
│ + enforceTimers(sessionId: string): void                          │
└──────────┬──────────────────────┬─────────────────────────────────┘
           │                      │                  
    ┌──────▼──────┐    ┌──────────▼────────┐    
    │IModeStrategy│    │SessionCacheService│    
    ├─────────────┤    ├───────────────────┤    
    │+ validate() │    │- redisClient      │    
    │+ getRules() │    ├───────────────────┤    
    └─────┬───────┘    │+ get(id)          │    
          │            │+ set(id, state)   │    
          │            └───────────────────┘    
  ┌───────┼────────┬─────────┬─────────┬─────────┐
  │       │        │         │         │         │
Speed  Twin  Colorblind  Flash    Mercy  GuessTheRest
Strategy Strategy Strategy Strategy Strategy Strategy

┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│    JokeService     │  │DictionaryRepository│  │  StatsRepository   │
├────────────────────┤  ├────────────────────┤  ├────────────────────┤
│+ fetchJoke()       │  │+ getRandomWord()   │  │+ save()            │
│+ validateAnswer()  │  │+ isValidWord()     │  │+ getByUser()       │
└────────────────────┘  └────────────────────┘  └────────────────────┘

┌────────────────────┐
│  UserRepository    │
├────────────────────┤
│+ getUser()         │
│+ createUser()      │
└────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│GameSessionDTO│  │GuessResultDTO│  │MercyResultDTO│
├──────────────┤  ├──────────────┤  ├──────────────┤
│+ sessionId   │  │+ result[]    │  │+ joke        │
│+ mode        │  │+ status      │  │+ status      │
│+ board       │  └──────────────┘  └──────────────┘
│+ attempts    │
└──────────────┘
```

**Rationale**: The `GameEngineService` uses a Strategy Pattern (`IModeStrategy`) to handle the vastly different validation rules between the six modes. This prevents massive switch statements and allows for isolated testing of devious logic like "Guess the Rest" color mapping.

---

## List of Classes

| Class Name | Package | Responsibility |
|------------|----------|----------------|
| `GameEngineService` | services | Orchestrates core game loops, mode routing, and validation |
| `GameController` | controllers | HTTP request handler for starting games and making guesses |
| `JokeService` | services | Fetches and validates dad joke answers for Show Mercy mode |
| `SessionCacheService` | services | Redis cache management for active, real-time games |
| `DictionaryRepository` | repositories | Database access for valid word lists |
| `StatsRepository` | repositories | Stores user win/loss records and mode preferences |
| `UserRepository` | repositories | Database access for user accounts |
| `GameSessionDTO` | models/dtos | Data Transfer Object for current board state sent to UI |
| `GuessResultDTO` | models/dtos | Data Transfer Object for guess evaluation results |
| `MercyResultDTO` | models/dtos | Data Transfer Object for mercy state joke prompt and outcome |
| `IModeStrategy` | strategies | Interface for handling specific game mode logic |
| `SpeedStrategy` | strategies | Speed Run mode: enforces per-guess and total time limits |
| `TwinStrategy` | strategies | Twin mode: manages linked two-word simultaneous solve |
| `ColorblindStrategy` | strategies | Colorblind mode: removes color cues from feedback |
| `FlashStrategy` | strategies | Flash/Memory mode: governs visible/whiteout cycle rules |
| `MercyStrategy` | strategies | Show Mercy mode: triggers dad joke prompt at max guesses |
| `GuessTheRestStrategy` | strategies | Guess the Rest mode: randomized color obfuscation logic |

---

## State Diagrams

### Game Session State Machine

```text
┌─────────────┐
│ Home Screen │
└──────┬──────┘
       │ User selects mode & clicks Start
       ▼
┌──────────────────┐
│  Game Active     │◄─────────┐
└──────┬───────────┘          │
       │                      │ Valid Guess (Game Continues)
       ├─ (Guess Submitted)───┘
       │
       ├─ (Time Expired - Speed/Flash modes) ──► ┌──────────────┐
       │                                         │  Game Over   │
       ├─ (Word Solved - Standard modes) ──────► │  (Win/Loss)  │
       │                                         └──────────────┘
       │
       └─ (Max Guesses Reached - Show Mercy Mode)
                 │
                 ▼
        ┌──────────────────┐
        │   Mercy State    │
        │ (Dad Joke Prompt)│
        └────────┬─────────┘
                 │
                 ├─ (Joke Answered Correctly) ──► Returns to Game Active (+1 Guess)
                 │
                 └─ (Joke Answered Wrong) ──────► Game Over (Loss)
```

---

## Flow Chart – Flash/Memory Client Loop

```text
START
  │
  ▼
User Selects "Flash/Memory" Mode
  │
  ▼
Client Initiates Game Loop
  │
  ▼
┌─────────────────────────────┐
│ Start 5-Minute Master Timer │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐◄──────┐
│ UI Visible (3 Seconds)      │       │
│ - Board displays            │       │
│ - Keyboard active           │       │
└──────┬──────────────────────┘       │
       │                              │ Loop continues until
       ▼                              │ game solved or 
┌─────────────────────────────┐       │ master timer expires
│ UI Whiteout (25 Seconds)    │       │
│ - Screen turns white        │       │
│ - Keyboard disabled         │       │
└──────┬──────────────────────┘       │
       │                              │
       └──────────────────────────────┘
```

---

## Development Risks and Failures

| Risk | Likelihood | Impact | Mitigation |
|------|------------|---------|------------|
| Client-Side Cheating | High | Ruins competitive integrity | Never send solution word or color mapping to client |
| Timer Desync | Medium | Players lose time | Server tracks absolute end-time; use `requestAnimationFrame` or CSS transitions for animations |
| Flash Mode Seizures | Medium | Health risk | Smooth fade transitions + warning |
| Dad Joke API Failure | Low | Mercy mode breaks | Fallback local JSON jokes |
| Dad Joke Answer Subjectivity | Medium | Unfair Mercy outcomes | Strict punchline matching or fuzzy string matching |
| Twin Mode Frustration | High | Unbeatable difficulty | Playtesting with shared vowels |
| Color Contrast Issues | Medium | Unreadable UI | Use predefined high-contrast palette for all modes including Guess the Rest |

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|--------|------------|----------|----------|
| Frontend | React | 18.x | UI rendering |
| Frontend | Tailwind CSS | 3.x | Styling |
| Backend | Node.js | 18.x LTS | Runtime |
| Backend | Express.js | 4.x | API framework |
| Backend | jsonwebtoken | 9.x | JWT authentication |
| Database | PostgreSQL | 14+ | Dictionaries & stats |
| Cache | Redis | 7.x | Active session storage |
| External API | icanhazdadjoke | v1 | Dad joke retrieval |

---

## APIs

### Start Game

```
POST /api/v1/games/start
Authorization: Bearer {jwt_token}
```

**Request**
```json
{
  "mode": "SPEED"
}
```

**Response**
```json
{
  "sessionId": "g12345",
  "mode": "SPEED",
  "status": "ACTIVE",
  "attemptsRemaining": 6,
  "timeRemainingMs": 300000,
  "board": []
}
```

---

### Submit Guess

```
POST /api/v1/games/{sessionId}/guess
Authorization: Bearer {jwt_token}
```

**Request**
```json
{
  "guess": "ORANGE"
}
```

**Response Example (Guess the Rest Mode)**

```json
{
  "sessionId": "g12345",
  "mode": "GUESS_THE_REST",
  "status": "ACTIVE",
  "attemptsRemaining": 4,
  "result": [
    {"letter": "O", "hex": "#FF5733", "status": "obfuscated"},
    {"letter": "R", "hex": "#333333", "status": "absent"},
    {"letter": "A", "hex": "#33FF57", "status": "obfuscated"},
    {"letter": "N", "hex": "#333333", "status": "absent"},
    {"letter": "G", "hex": "#333333", "status": "absent"},
    {"letter": "E", "hex": "#333333", "status": "absent"}
  ],
  "message": "Keep deducing!"
}
```

---

### Request Mercy

```
POST /api/v1/games/{sessionId}/mercy
Authorization: Bearer {jwt_token}
```

**Request**
```json
{
  "jokeAnswer": "Because it had no body to go with!"
}
```

**Response (Correct Answer)**
```json
{
  "sessionId": "g12345",
  "mode": "MERCY",
  "mercyGranted": true,
  "attemptsRemaining": 1,
  "joke": "Why didn't the skeleton go to the party?",
  "message": "Correct! You earned one more guess."
}
```

---

## Public Interfaces (Frontend)

```typescript
type GameMode = "SPEED" | "TWIN" | "COLORBLIND" | "FLASH" | "MERCY" | "GUESS_THE_REST";

interface GameState {
  sessionId: string;
  mode: GameMode;
  board: GuessResult[][];
  attemptsRemaining: number;
  timeRemainingMs?: number;
  isMercyActive?: boolean;
}

interface GuessResult {
  letter: string;
  status: "correct" | "present" | "absent" | "obfuscated";
  hex?: string;
}
```

---

## Data Schemas – Redis

```
game_session:{sessionId}
TTL: 3600 seconds
```

Example:

```json
{
  "userId": "u987",
  "mode": "GUESS_THE_REST",
  "targetWord": "PLANET",
  "maxGuesses": 6,
  "guessesUsed": 0,
  "exactColorHex": "#FF5733",
  "partialColorHex": "#33FF57",
  "absentColorHex": "#333333",
  "startedAt": "2026-02-24T21:35:00Z",
  "endsAt": "2026-02-24T21:40:00Z"
}
```

---

## Security and Privacy

1. Anti-scraping – dictionary never sent to client  
2. State protection – color mappings live only in Redis  
3. Rate limiting – prevents brute-force attacks  
4. Data anonymization – no PII stored in analytics  

---

**End of Development Specification**