# AI Chatbot Admin Panel & Frontend Widget

## Overview
This project consists of two main components:
1.  **Admin Panel**: A comprehensive dashboard for managing chatbot intents, questions, and answers with strict validation logic.
2.  **Frontend Widget**: A floating chatbot widget integrated into the school website with auto-open functionality and sound effects.

## 🚀 Features

### 🔧 Admin Panel (`/admin`)
The Admin Panel is built with Vanilla JavaScript and Supabase.

*   **Intent Management**: Create, edit, and delete intents.
*   **Strict Validation**:
    *   **9-Question Rule**: Every intent MUST have exactly **9 unique question variations** to be saved or published.
    *   **Answer Requirement**: Every intent MUST have at least **1 answer**.
*   **Bulk Import**:
    *   Import intents from JSON files.
    *   **Strict Import Validation**: Automatically **skips** any intent that does not have exactly 9 questions and at least 1 answer.
*   **Duplicate Detection**: Scan for duplicate questions across the database using semantic analysis (backend API).
*   **Publishing Workflow**: Drafts must be published to be live. Publishing triggers an embedding update.

### 💬 Frontend Widget (`/frontend`)
The Frontend Widget is a lightweight, drop-in accessible chatbot.

*   **Auto-Open**: The chatbot automatically opens **5 seconds** after the page loads to engage users.
*   **Sound Effects**:
    *   **Open**: Plays a "pop" sound when the widget opens (auto or manual).
    *   **Sent**: Plays a sound when the user sends a message.
    *   **Delivered**: Plays a sound when the bot replies.
    *   *Note*: Typing sounds were removed for a cleaner experience.
*   **3D Tour Integration**: Able to navigate the 3D Virtual Tour (`Vista`) based on user commands.
*   **Responsive**: Fully responsive design for mobile and desktop.

## 📁 Project Structure

```
/admin
  ├── js/
  │   ├── intents.js    # CRUD & Validation Logic
  │   ├── import.js     # JSON Import with Strict Validation
  │   └── ...
  ├── index.html        # Dashboard Entry
  └── ...

/frontend
  ├── assets/           # Sound files (open.mp3, sent.mp3, etc.)
  ├── js/
  │   ├── Chatbot.js    # Main Loader & Auto-Open Logic
  │   ├── ui.js         # UI Rendering & Sound Triggers
  │   ├── sound.js      # Sound Manager
  │   └── ...
  └── index.htm         # Main Page
```

## 🛠️ Validation Rules

### 1. Intent Validator (`intents.js`)
When saving a draft:
- Loops through inputs `q-1` to `q-9`.
- If **any** input is empty -> **Error**: "All 9 questions are mandatory."
- Prevents saving and publishing until resolved.

### 2. Import Validator (`import.js`)
When uploading `school-data.json`:
- Parsed JSON is iterated.
- Checks: `if (questions.length !== 9)` or `if (responses.length === 0)`
- **Action**: Logs a warning and **SKIPS** the item. Only valid items are imported.

## 🔊 Sound System
- **Sent**: `assets/sent.mp3` (User action)
- **Delivered**: `assets/delivered.mp3` (Bot reply)
- **Open/Close**: `assets/open.mp3` / `assets/close.mp3`
- **Auto-Open**: Triggers `click()` on the toggle button after 5000ms, which plays the Open sound.

## 📦 Setup
1.  Configure `js/config.js` with your Supabase URL and Key.
2.  Serve the `admin` folder via a local server or static host.
3.  Include `Chatbot.js` in your frontend project to load the widget.
