# Cloud Deployment Guide (Turso & Render)

This guide walks you through deploying the **AI Site Safety Incident Report Generator** to a live public URL using **Turso** (for the serverless database) and **Render** (for backend hosting and static frontend serving).

---

## 💾 1. Turso Database Setup (Serverless LibSQL)

Turso is a serverless SQLite database based on LibSQL, optimized for low latency and cloud deployments.

1. **Sign Up:** Go to [Turso.tech](https://turso.tech/) and sign up for a free account.
2. **Create a Database:**
   * Go to your Turso dashboard.
   * Click **Create Database**.
   * Name your database (e.g., `crownridge-safety`).
   * Select a region closest to your target users (e.g., Mumbai `bom` or Singapore `sin` for India).
3. **Retrieve Credentials:**
   * On your database page, copy the **Database URL** (e.g., `libsql://crownridge-safety-username.turso.io`).
   * Click on **Generate Token** and copy the **Auth Token** string.
4. **Local Verification (Optional):**
   * Paste these credentials into the local [backend/.env](file:///c:/term-4%20intenship%20programme/AISITE%20SAFETY%20INCIDENT%20REPORT%20GENERATOR/backend/.env) file to verify that the local server successfully connects to the Turso cloud instead of the local SQLite file.

*(Note: Table creation and preset seeding are performed automatically on the first server boot. You do not need to upload SQL schemas manually).*

---

## 🚀 2. Render Cloud Deployment

Render is a modern cloud hosting platform. We will host the Node.js Express server on Render, which will serve our backend APIs and feed static frontend layouts to the browser.

### Step 1: Upload Code to GitHub
Ensure you have committed and pushed all files to your GitHub repository (e.g., `https://github.com/karthikyadavmamindla0-pixel/AISITE-SAFETY-INCIDENT-REPORT-GENERATOR.git`).

### Step 2: Create a Web Service on Render
1. Go to [Render.com](https://render.com/) and sign up / log in.
2. Click **New** (top right) $\rightarrow$ **Web Service**.
3. Link your GitHub account and select your repository: `AISITE-SAFETY-INCIDENT-REPORT-GENERATOR`.

### Step 3: Configure Build and Run Directives
Configure the settings as follows:
* **Name:** `ai-safety-report-desk` (or any unique name)
* **Environment:** `Node`
* **Region:** Select the region closest to your database (e.g., Singapore).
* **Branch:** `main`
* **Root Directory:** `backend` *(CRITICAL: Since our Node.js app is located in the `/backend` subdirectory, you must specify this so Render runs npm scripts inside the correct path).*
* **Build Command:** `npm install`
* **Start Command:** `npm start`
* **Instance Type:** Select the **Free** tier.

### Step 4: Configure Environment Variables
Click on the **Environment** tab on the Render setup screen and add the following keys:

| Key | Value | Description |
|-----|-------|-------------|
| `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini API Key. |
| `TURSO_DATABASE_URL` | `libsql://...` | The Database URL copied from your Turso console. |
| `TURSO_AUTH_TOKEN` | `eyJhbGci...` | The Auth Token copied from your Turso console. |
| `PORT` | `10000` | Render's default web service port. |

### Step 5: Deploy
1. Click **Deploy Web Service** at the bottom of the page.
2. Render will download the code, install the dependencies, execute the table queries inside your Turso database, and launch the server.
3. Once the logs show `Server is running on port 10000`, click on the public URL at the top left of the Render dashboard (e.g., `https://ai-safety-report-desk.onrender.com`).
4. The application is now live! Anyone visiting this URL can access the incident desk.
