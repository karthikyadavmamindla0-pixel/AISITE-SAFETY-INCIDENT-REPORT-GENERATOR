# AI Site Safety Incident Report Generator

**Client:** Crownridge LLP  
**Product Version:** 1.0.0 (Production Prototype)  
**Assigned Domain:** Infrastructure Construction & Project Management (Telangana & Andhra Pradesh)

This system provides site supervisors with a responsive digital workspace to log safety incident variables. The backend automatically constructs a compliance-structured prompt and invokes the Google Gemini API to compile a formal, legally structured, and audit-ready Safety Incident Report (conforming to BOCW Section 40 and Indian Standard safety codes) suitable for regulatory submission.

---

## 🚀 Key Features

1. **Quick Template Presets:** 3 pre-configured incident templates (Scaffolding Fall, Excavation Cave-in, Electrical Flash) seed the workspace database, allowing safety auditors to test complete flows in one click.
2. **Multi-Tab Structured Logs:** Tabbed form interface with responsive design, instant field-level validations, and character limits.
3. **Regulatory Prompt Architecture (v4):** System prompts inject specific Indian Standard (IS) codes (e.g., IS 4912 for falling hazards, IS 3764 for excavations) and draft detailed Root Cause Analysis (RCA) and Corrective and Preventive Actions (CAPA) with action deadlines.
4. **Permanent Incident Register:** Tabular ledger of all past reports with real-time global text search, classification filters, and severity-level badge groupings.
5. **Interactive Feedback & Quality Review:** Real-time star-rating validator for compiled report text, updating quality trends instantly.
6. **Admin Panel & Quality Charts:** KPI stats (total reports, average score, response latency) and live Chart.js visualizations (severity doughnuts, star ratings distribution, high-frequency site lists).
7. **Document Sheet Controls:** Full copy-to-clipboard, secure database share-links, and print stylesheets optimized for downloading high-resolution letterhead PDFs.
8. **AI Offline Fallback:** If the Gemini API key is missing or invalid, the backend automatically triggers a local document layout generator to ensure the interface remains fully operational during demonstrations.

---

## 🛠️ Tech Stack & Directory Structure

* **Frontend:** Vanilla HTML5, Custom CSS Grid/Flexbox (Dark Theme with Safety Amber Accent), JavaScript (ES6+), Chart.js (CDN), Marked.js (CDN), FontAwesome (CDN)
* **Backend:** Node.js, Express, Cors, Dotenv, `@google/generative-ai`
* **Database:** SQLite (persisted locally inside the backend directory as `reports.db`)

```
/
├── backend/
│   ├── database.js          # Database setup, migrations, and template seeding
│   ├── server.js            # Express API routing and Gemini API wrapper
│   ├── package.json         # Backend node dependencies
│   ├── .env.example         # Template configuration env file
│   └── .env                 # Environment variables (API Keys, Port)
├── frontend/
│   ├── index.html           # Main dashboard UI structure
│   ├── style.css            # Dark/Amber design system, responsive styles, print media
│   └── app.js               # Tab controls, validations, API fetches, and Charts
├── README.md                # System documentation
└── run.bat                  # One-click Windows startup script
```

---

## ⚙️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)

### 1. Configure the Gemini API Key
1. Obtain a free Gemini API key from the [Google AI Studio](https://aistudio.google.com/).
2. Open the `/backend/.env` file in a text editor:
   ```env
   PORT=5000
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
3. Save the file.

### 2. Run the Application
You can start both backend installation and runtime in one double-click using the provided utility:
1. Double-click the **`run.bat`** file in the project root directory.
2. The script will automatically install backend dependencies and start the local Express web server.
3. Once running, open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

*(Alternatively, run `cd backend && npm install && npm start` manually in your shell).*

---

## 🔌 API Reference Guide

### `POST /api/generate`
Compiles incident narrative and generates safety report using Gemini.
* **Payload:**
  ```json
  {
    "supervisor_name": "Ramesh Kumar",
    "supervisor_role": "Safety Manager",
    "site_location": "Pier 24 Flyover Site",
    "incident_timestamp": "2026-06-27T10:30",
    "incident_type": "Fall from Height",
    "severity_level": "High",
    "raw_description": "Mason slipped from scaffolding level 3...",
    "weather_conditions": "Clear skies",
    "immediate_actions": "Administered first aid and cordoned area",
    "witness_details": "Witness statement logged from crew foreman"
  }
  ```
* **Response (201):**
  ```json
  {
    "id": "rep-XYZ123",
    "generated_report_markdown": "# CROWNRIDGE LLP...",
    "response_time_ms": 1250,
    "is_mock": false
  }
  ```

### `GET /api/history`
Retrieves list of past incidents with ratings.
* **Response (200):** Array of logged incidents.

### `GET /api/history/:id`
Retrieves full markdown details and comments for a single record.

### `POST /api/feedback`
Logs safety auditor ratings.
* **Payload:** `{ "report_id": "rep-XYZ123", "rating_stars": 5, "comments": "Accurate RCA" }`

### `GET /api/admin/analytics`
Compiles KPI statistics, rating distributions, and high-frequency site registers.

---

## 🏗️ Indian Standard Safety References Used
* **IS 4912:** Safety requirements for floor/wall openings, railings, scaffolding boards.
* **IS 3764:** Safety code for trench excavation and shoring practices.
* **BOCW Act, 1996:** Central government directives for safety, health, and welfare.
