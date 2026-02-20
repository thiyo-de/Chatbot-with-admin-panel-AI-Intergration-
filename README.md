# 🤖 Montfort ICSE Chatbot — AI-Powered School Assistant

> An intelligent, full-stack chatbot system built for **Montfort ICSE School** with a complete **Admin Panel**, **AI Backend**, and an embeddable **Frontend Chat Widget** — powered by **Google Gemini AI** and **Supabase**.

| Component | Link |
|-----------|------|
| 🖥️ **Admin Panel** | [montfort-chatbot-admin-panel.netlify.app](https://montfort-chatbot-admin-panel.netlify.app/) |
| 💬 **Live Chatbot** | [montfort-icse.netlify.app](https://montfort-icse.netlify.app/) |

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Feature List (A–Z)](#-feature-list-az)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Backend Deep Dive](#-backend-deep-dive)
- [Admin Panel Deep Dive](#-admin-panel-deep-dive)
- [Frontend Chat Widget Deep Dive](#-frontend-chat-widget-deep-dive)
- [Database Schema (Supabase)](#-database-schema-supabase)
- [API Endpoints](#-api-endpoints)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🏗 Architecture Overview

```
┌──────────────────┐       ┌──────────────────────┐       ┌──────────────┐
│  Frontend Widget │──────▶│   Express.js Backend  │──────▶│   Supabase   │
│  (Vanilla JS)    │  HTTP │  (Node.js + Gemini)   │  SQL  │  (Postgres + │
│                  │◀──────│                       │◀──────│   pgvector)  │
└──────────────────┘       └──────────────────────┘       └──────────────┘
                                    ▲
                                    │ HTTP
                           ┌────────┴─────────┐
                           │   Admin Panel     │
                           │  (Static HTML +   │
                           │   Supabase SDK)   │
                           └──────────────────┘
```

**Flow:**
1. User sends a question via the Chat Widget
2. Backend applies **Two-Stage Spell Correction** (local + LLM)
3. Generates a **768-dimensional embedding** via Gemini
4. Runs a **semantic vector search** against Supabase `pgvector`
5. Returns the best matching answer from the database (no hallucination)
6. Admin Panel manages intents, questions, and answers via Supabase directly

---

## ✨ Feature List (A–Z)

### A — Ambiguity Clarification
When the top 2 matches are within **0.05 similarity** of each other, the chatbot asks: *"Did you mean X or Y?"* instead of guessing wrong.  
📄 `chatController.js` → Lines 186–208

### B — Bulk Publish
Publish multiple intents at once. The system processes them sequentially with a **3-second delay** between batches to respect Gemini rate limits. Includes a real-time **log modal** showing progress.  
📄 `intents.js` → `performBulkPublish()`

### C — Circuit Breaker (Rate Limit Protection)
When Gemini returns a `429` (quota exceeded), the backend automatically:
1. **Rotates** to the next API key
2. **Retries** the request
3. If all keys fail, returns a safe fallback — never crashes.  
📄 `geminiService.js` → `callGemini()`

### D — Domain Guard (Confidence Floor)
Any match below **0.70 similarity** is blocked from being returned. This prevents the bot from answering unrelated/out-of-domain questions with low-confidence guesses.  
📄 `chatController.js` → `MIN_CONFIDENCE_FLOOR = 0.70`

### E — Embedding Generation (Gemini)
Uses `gemini-embedding-001` model to generate **768-dimensional** semantic vectors for each question. These are stored in Supabase and used for similarity search via `pgvector`.  
📄 `aiService.js` → `generateEmbedding()`

### F — Fallback (Fixed, No LLM Hallucination)
When no database match is found above the threshold, the chatbot returns a **fixed, hardcoded** message — it does NOT invoke the LLM to make up an answer:  
> *"I can only answer Montfort School related questions."*  
📄 `chatController.js` → Line 226

### G — Gemini AI Integration
Full integration with **Google Gemini API** for:
- Spell correction (LLM slow path)
- Grammar fixing
- Embedding generation
- RAG answer synthesis  
📄 `geminiService.js` (IUI Engine v2.5)

### H — History / Session Memory
The frontend tracks the last **5 conversation turns** (user + bot). It includes a **10-minute inactivity timeout** that auto-clears history. History is sent to the backend with each request for context-aware follow-ups.  
📄 `chat.js` → `conversationHistory[]`

### I — Intent Router (AI Navigation)
Detects navigation commands like *"go to library"*, *"open boys hostel"*. Uses **regex verb detection** + **Levenshtein fuzzy matching** against panorama/project names. Prevents navigation keywords from triggering fact-based answers.  
📄 `aiIntentRouter.js`

### J — JSON Import
Bulk-import intents from JSON files via the admin panel. Supports multiple JSON formats (`intents`, `patterns`, `responses`, etc.). Validates that each intent has **exactly 9 questions** and **at least 1 answer** before importing.  
📄 `import.js`

### K — Key Manager (Multi-Key Rotation)
Supports **up to 10+ Gemini API keys** loaded from environment variables (`GEMINI_API_KEY`, `GEMINI_API_KEY_2` through `GEMINI_API_KEY_10`, or comma-separated `GEMINI_API_KEYS`). On rate-limit, keys rotate automatically.  
📄 `utils/keyManager.js`

### L — Levenshtein Distance
Custom implementation used for fuzzy string matching in both the **intent router** (panorama name matching) and the **local spell-fix** (vocabulary correction).  
📄 `utils/stringUtils.js`

### M — Merged Word Splitter
Detects accidentally merged words and splits them using the vocabulary database:
- `"waterin"` → `"water in"`
- `"hostelstudents"` → `"hostel students"`  
📄 `geminiService.js` → `splitMergedWords()`

### N — Navigation Support (3D Tour)
Integration with **Vista** (3D panorama viewer) to navigate to specific locations. The chatbot can:
- Open panoramas by name
- Open projects by title or URL
- List all available panoramas and projects  
📄 `vista.js`

### O — One-Click Publish
Single intent publish directly from the editor. Saves the draft first, validates all fields, then calls the backend to generate embeddings.  
📄 `intents.js` → `publishIntent()`

### P — Publish with Atomic Rollback
If embedding generation fails mid-publish, the system:
1. **Deletes partial embeddings**
2. **Reverts status** back to `"draft"`
3. **Aborts** remaining intents in bulk operations  
📄 `publishController.js` → `processSingleIntent()`

### Q — Question Validation (9-Question Rule)
Every intent must have **exactly 9 question variations** to ensure semantic diversity. The admin panel enforces this both during manual creation and JSON import.  
📄 `intents.js` → `saveDraft()`

### R — RAG Pipeline (Retrieval-Augmented Generation)
The complete pipeline:
1. **Input Cleaning** (zero-width chars, emojis, smart quotes)
2. **Word Split Fix** (merged words)
3. **Local Spell Fix** (Levenshtein + vocabulary)
4. **LLM Spell Fix** (Gemini, only on low-confidence)
5. **Embedding Generation** (768-dim)
6. **Semantic Search** (pgvector RPC)
7. **Deduplication** (remove identical answers)
8. **Domain Guard** (confidence floor at 0.70)
9. **Ambiguity Check** (top-2 gap < 0.05)
10. **Direct DB Answer** (no LLM generation for final answer)

### S — Spell Correction (Two-Stage Strategy)

**Stage 1 — Fast Path (Local Only, ~0ms):**
1. `preClean()` — Remove zero-width chars, normalize quotes, strip emojis
2. `splitMergedWords()` — Split accidentally joined words using vocabulary
3. `localSpellFix()` — Levenshtein-based correction against known vocabulary (skips words < 5 chars to avoid false corrections like `"text"` → `"test"`)

**Stage 2 — Slow Path (LLM, only if Fast Path confidence < 0.85):**
4. `correctGrammar()` — Gemini-powered grammar and spelling correction with strict rules: **no noun swaps, no meaning changes, no invented words**

📄 `geminiService.js` → `quickCorrection()`, `correctSpelling()`  
📄 `chatController.js` → `FAST_PATH_THRESHOLD = 0.85`

### T — Typewriter Effect (Hybrid)
Bot messages appear with a character-by-character typewriter animation. After typing completes, the plain text is replaced with **linkified HTML** (URLs, emails, phone numbers become clickable). This prevents broken link rendering during animation.  
📄 `ui.js` → `typeBotMessage()`

### U — Universal Linkify
Automatically converts:
- `https://` and `www.` URLs → clickable links
- Email addresses → `mailto:` links
- Phone numbers → `tel:` links  
📄 `ui.js` → `linkify()`

### V — Vocabulary Service (Dynamic)
Loads **all question texts and intent names** from Supabase to build a vocabulary set. This powers the local spell correction and merged word detection. Can be refreshed live via the `/api/refresh-vocab` endpoint.  
📄 `services/vocabService.js`

### W — Widget (Embeddable Chat)
The entire chatbot is a **single-file embeddable widget** (`Chatbot.js`). It dynamically:
1. Injects CSS
2. Creates all DOM elements (toggle button, chat window, sound elements)
3. Loads all scripts in sequence (`config → sound → ui → vista → chat`)  
📄 `Chatbot.js`

### X — CORS (Cross-Origin)
Backend uses `cors({ origin: "*" })` for development. In production, this should be restricted to specific domains.  
📄 `server.js`

### Y — Your Data, Your Answers
The system **never hallucinates** — answers come directly from the Supabase database. The LLM is used only for spell correction and embedding generation, never for generating final answers.

### Z — Zero-Downtime Key Switching
API keys are managed at runtime. When one key hits its quota, the system seamlessly switches to the next key without any downtime or errors visible to the user.  
📄 `utils/keyManager.js` → `rotate()`

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript, CSS3, HTML5 |
| **Admin Panel** | Static HTML + Supabase JS SDK (CDN) |
| **Backend** | Node.js + Express.js (ES Modules) |
| **AI** | Google Gemini API (Flash + Embedding) |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **Auth** | Supabase Authentication |
| **Hosting** | Netlify (Frontend/Admin), Render (Backend) |

---

## 📁 Project Structure

```
Chatbot/
├── .gitignore                          # Excludes secrets and node_modules
│
├── chatbot-backend-admin-panel/        # 🔧 Backend (Express.js API)
│   ├── server.js                       # Entry point, routes
│   ├── package.json                    # Dependencies
│   ├── config/
│   │   └── env.js                      # Environment config
│   ├── controllers/
│   │   ├── chatController.js           # Main chat logic (RAG pipeline)
│   │   ├── publishController.js        # Publish intent + embeddings
│   │   ├── duplicateController.js      # Duplicate scan endpoint
│   │   └── aiIntentRouter.js           # Navigation intent detection
│   ├── services/
│   │   ├── geminiService.js            # IUI Engine v2.5 (Spell, Embed, RAG)
│   │   ├── aiService.js                # AI facade (grammar, embedding)
│   │   ├── vocabService.js             # Dynamic vocabulary loader
│   │   ├── duplicateService.js         # Semantic duplicate scanner
│   │   └── supabaseService.js          # Supabase admin client
│   └── utils/
│       ├── keyManager.js               # Multi-key rotation
│       └── stringUtils.js              # Levenshtein distance
│
├── admin/                              # 🖥️ Admin Panel (Static Website)
│   ├── index.html                      # Login page
│   ├── admin.html                      # Main admin page (tabs)
│   ├── dashboard.html                  # Dashboard stats
│   ├── intents.html                    # Intent CRUD
│   ├── import.html                     # JSON import
│   ├── duplicates.html                 # Duplicate management
│   ├── css/
│   │   └── styles.css                  # Admin styles
│   └── js/
│       ├── config.example.js           # ⚠️ Template (copy to config.js)
│       ├── supabaseClient.js           # Supabase client init
│       ├── auth.js                     # Login/logout/session guard
│       ├── dashboard.js                # Dashboard stats
│       ├── intents.js                  # Intent management + publish
│       ├── import.js                   # JSON import handler
│       └── duplicates.js               # Duplicate scan UI
│
└── frontend Code/                      # 💬 Chat Widget (Embeddable)
    ├── index.html                      # Demo page
    ├── Chatbot.js                      # ⭐ Self-contained widget loader
    ├── Links.json                      # Project links for navigation
    ├── css/
    │   └── style.css                   # Widget styles
    ├── assets/
    │   └── logo.svg                    # Bot avatar
    ├── locale/
    │   └── en.txt                      # Panorama labels
    └── js/
        ├── config.example.js           # ⚠️ Template (copy to config.js)
        ├── chat.js                     # Session-aware chat logic
        ├── ui.js                       # Typewriter + UI system
        ├── vista.js                    # 3D tour integration
        └── sound.js                    # Sound effects
```

---

## 🔧 Backend Deep Dive

### Chat Pipeline (`chatController.js`)

```
User Question
     │
     ▼
[1] AI Intent Router ──▶ Navigation? ──▶ Return { intent: "pano", target }
     │ No
     ▼
[2] Quick Correction (Local) ──▶ preClean + splitWords + localSpellFix
     │
     ▼
[3] Generate Embedding (768-dim)
     │
     ▼
[4] Semantic Search (pgvector RPC, threshold: 0.45)
     │
     ▼
[5] Confidence Check
     ├── ≥ 0.85 ──▶ Fast Path ✅ (use result directly)
     └── < 0.85 ──▶ Slow Path 🐢 (LLM correction → re-embed → re-search)
     │
     ▼
[6] Domain Guard (reject if < 0.70)
     │
     ▼
[7] Ambiguity Check (top-2 gap < 0.05?)
     ├── Yes ──▶ "Did you mean X or Y?"
     └── No  ──▶ Return direct DB answer
     │
     ▼
[8] Fallback ──▶ Fixed message (NO LLM generation)
```

### Key Manager (`keyManager.js`)

```
.env file:
  GEMINI_API_KEY=key1
  GEMINI_API_KEY_2=key2
  GEMINI_API_KEY_3=key3
  ...up to GEMINI_API_KEY_10

KeyManager loads all keys → Round-robin rotation on 429 errors
```

### Vocabulary Service (`vocabService.js`)

Fetches all `question_text` from the `questions` table and all `name` from the `intents` table. Extracts individual words (≥ 3 chars) to build a vocabulary `Set` for local spell correction.

### Duplicate Scanner (`duplicateService.js`)

Scans all **draft** questions, generates embeddings, and searches the entire database for matches above **0.90 similarity**. Creates flags that the admin can resolve (ignore or delete).

---

## 🖥️ Admin Panel Deep Dive

### Pages

| Page | Purpose |
|------|---------|
| `index.html` | Login page (Supabase email/password auth) |
| `admin.html` | Main dashboard with tab navigation |
| `dashboard.html` | Stats: total intents, published, drafts, flags |
| `intents.html` | Full CRUD for intents (create, edit, delete, publish) |
| `import.html` | JSON file import with drag-and-drop |
| `duplicates.html` | View and resolve duplicate content flags |

### Key Features

- **Auth Guard**: All pages (except login) require an active Supabase session
- **Bulk Operations**: Select multiple intents → publish or delete at once
- **Real-time Logs**: Publish and scan operations show live progress in a modal
- **9-Question Rule**: Enforces exactly 9 question variations per intent
- **Version Tracking**: Each intent has a version number

---

## 💬 Frontend Chat Widget Deep Dive

### Embedding the Chatbot

Add this single line to any HTML page:

```html
<script src="Chatbot.js"></script>
```

This self-contained file will:
1. Inject the CSS stylesheet
2. Create the floating chat button and chat window
3. Load all audio elements
4. Load scripts in order: `config → sound → ui → vista → chat`

### Key Features

| Feature | Description |
|---------|-------------|
| **Typewriter Effect** | Messages appear character-by-character, then convert to clickable HTML |
| **Sound Effects** | Typing, delivered, open, and close sounds |
| **Session Memory** | Tracks last 5 turns, auto-clears after 10 min inactivity |
| **Smart Greetings** | Detects "hi", "hello", etc. and shows a welcome menu |
| **Help Command** | Type "help" or "menu" for feature overview |
| **List All** | Type "list all" to see all panoramas and projects |
| **3D Navigation** | Commands like "go to library" open panoramic views |
| **Auto-Linkify** | URLs, emails, and phone numbers become clickable |
| **Keyboard Support** | Enter to send, Escape to close widget |

---

## 🗄 Database Schema (Supabase)

```
intents
├── id (uuid, PK)
├── name (text)
├── slug (text, unique)
├── status (text: 'draft' | 'published')
├── version (integer)
├── created_by (uuid, FK → auth.users)
├── created_at, updated_at (timestamp)

questions
├── id (uuid, PK)
├── intent_id (uuid, FK → intents)
├── question_text (text)
├── order_index (integer, 1–9)
├── is_active (boolean)
├── created_by (uuid)

answers
├── id (uuid, PK)
├── intent_id (uuid, FK → intents)
├── answer_text (text)
├── is_active (boolean)
├── created_by (uuid)

embeddings
├── intent_id (uuid, FK → intents)
├── question_id (uuid, FK → questions)
├── model (text, e.g. 'gemini-embedding-001')
├── dims (integer, 768)
├── vector (vector(768))

duplicate_flags
├── id (uuid, PK)
├── source_intent_id, source_question_id (uuid)
├── matched_intent_id, matched_question_id (uuid)
├── similarity (float)
├── resolution (text: 'unresolved' | 'ignored' | 'deleted')
```

### Key RPC Functions

- **`match_embeddings`** — Semantic search (cosine similarity) against published intents
- **`find_similar_questions`** — Duplicate detection across all questions

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/chat` | Send a user question and get an answer |
| `POST` | `/api/publish` | Publish intent(s) and generate embeddings |
| `POST` | `/api/scan-duplicates` | Scan for duplicate questions |
| `POST` | `/api/refresh-vocab` | Reload vocabulary from database |

### Chat Request Body

```json
{
  "question": "What is the school timing?",
  "panoNames": ["Library", "Boys Hostel", "Chapel"],
  "projectNames": ["School Website", "Virtual Tour"],
  "history": [
    { "role": "user", "text": "hello" },
    { "role": "bot", "text": "Hi there!" }
  ],
  "lastMatchedIntent": "school_timing"
}
```

### Chat Response

```json
{
  "answer": "School timings are 9:00 AM to 3:30 PM.",
  "matched_question": "What are the school timings?",
  "normalizedQuestion": "what is the school timing",
  "confidence": 0.92
}
```

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js (v18+)
- Supabase account with pgvector extension enabled
- Google Gemini API key(s)

### Step 1: Clone

```bash
git clone https://github.com/thiyo-de/Chatbot-with-admin-panel-AI-Intergration-.git
cd Chatbot-with-admin-panel-AI-Intergration-
```

### Step 2: Backend Setup

```bash
cd chatbot-backend-admin-panel
npm install
```

### Step 3: Create `.env` file

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_primary_key
GEMINI_API_KEY_2=your_second_key
GEMINI_API_KEY_3=your_third_key
GEMINI_MODEL=gemini-flash-latest
PORT=3000
```

### Step 4: Configure Frontend

```bash
# Admin Panel
cp admin/js/config.example.js admin/js/config.js
# Edit admin/js/config.js with your Supabase URL, anon key, and backend URL

# Frontend Widget
cp "frontend Code/js/config.example.js" "frontend Code/js/config.js"
# Edit with your backend URL
```

### Step 5: Start Backend

```bash
cd chatbot-backend-admin-panel
npm start        # Production
# or
npm run dev      # Development (with hot reload)
```

### Step 6: Open Admin Panel

Open `admin/index.html` in a browser (or deploy to Netlify).

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (bypasses RLS) |
| `GEMINI_API_KEY` | ✅ | Primary Gemini API key |
| `GEMINI_API_KEY_2` to `_10` | Optional | Additional keys for rotation |
| `GEMINI_API_KEYS` | Optional | Comma-separated list of keys |
| `GEMINI_MODEL` | Optional | Model name (default: `gemini-flash-latest`) |
| `PORT` | Optional | Server port (default: `3000`) |

> ⚠️ **Security**: The `config.js` files (admin + frontend) contain Supabase anon keys and are excluded from Git via `.gitignore`. Use the `config.example.js` templates to create your local copies.

---

## 🌍 Deployment

### Backend → Render

1. Create a Web Service on [render.com](https://render.com)
2. Connect the GitHub repo
3. Set root directory: `chatbot-backend-admin-panel`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add all environment variables

### Admin Panel → Netlify

1. Drag the `admin/` folder to [netlify.com](https://netlify.com)
2. Create `admin/js/config.js` with production values

### Frontend Widget → Netlify

1. Drag the `frontend Code/` folder to Netlify
2. Create `frontend Code/js/config.js` with production backend URL

---

## 📜 License

This project is proprietary and maintained for **Montfort ICSE School**.

---

*Built with ❤️ using Google Gemini AI, Supabase, and Express.js*
