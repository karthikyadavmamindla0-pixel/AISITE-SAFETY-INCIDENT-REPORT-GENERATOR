const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Serve frontend statically
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-safety-incident-report-generator' });
});

// Initialize Gemini API
let genAI = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini AI initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini AI:', err.message);
  }
} else {
  console.warn('WARNING: GEMINI_API_KEY is not set in environment variables. Server will use mock report generation fallback.');
}

// Helper to generate a unique short ID for reports
function generateShortId() {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Mock fallback generator
function generateMockReport(inputs) {
  const year = new Date().getFullYear();
  const shortId = Math.random().toString(36).substr(2, 5).toUpperCase();
  const refId = `CR-INC-${year}-${shortId}`;
  
  return `# CROWNRIDGE LLP - SAFETY INCIDENT REPORT
## 1. ADMINISTRATIVE INFORMATION
- **Report Reference:** ${refId}
- **Reporting Officer:** ${inputs.supervisor_name} (${inputs.supervisor_role})
- **Date/Time of Incident:** ${inputs.incident_timestamp}
- **Project Location/Site:** ${inputs.site_location}

## 2. INCIDENT CLASSIFICATION
- **Incident Type:** ${inputs.incident_type}
- **Severity Rating:** ${inputs.severity_level} (Requires local site safety review)
- **Weather Conditions:** ${inputs.weather_conditions || 'Not Documented'}

## 3. INCIDENT DESCRIPTION
On ${inputs.incident_timestamp}, a safety incident classified as **${inputs.incident_type}** occurred at the **${inputs.site_location}** project site.
**Incident Narrative:**
"${inputs.raw_description}"

This incident was flagged with a severity rating of **${inputs.severity_level}** by reporting supervisor ${inputs.supervisor_name}.

## 4. IMMEDIATE RESPONSE & ACTIONS TAKEN
${inputs.immediate_actions ? `The following immediate safety responses were executed on-site:
"${inputs.immediate_actions}"` : 'No immediate corrective actions were documented by the supervisor at the time of reporting. Immediate review of emergency response log recommended.'}

## 5. WITNESS OBSERVATIONS
${inputs.witness_details ? `The following statements and details regarding witnesses were logged:
"${inputs.witness_details}"` : 'No direct eye-witnesses were documented on site during the initial response stage. Standard safety protocol suggests a review of nearby CCTV or sub-contractor shifts.'}

## 6. REGULATORY & STANDARDS ANALYSIS
- **Governing Regulation:** Section 40 of the Building and Other Construction Workers (BOCW) Act, 1996.
- **Safety Standard References:** 
  - *For Falls:* Indian Standard IS 4912 (Safety requirements for floor and wall openings, railings and toe boards).
  - *For Trench Excavations:* Indian Standard IS 3764 (Safety code for excavation work).
  - *For Electrical:* Central Electricity Authority (CEA) Safety Regulations.
- **Compliance Status:** The incident indicates a localized variance from standard safety operating procedures. Further forensic review is required to verify subcontractor compliance certificates.

## 7. ROOT CAUSE ANALYSIS (RCA)
- **Direct Cause (Immediate Trigger):** Failure to enforce primary safety barriers or verify structural integrity before operation.
- **Indirect/Contributing Cause:** ${inputs.weather_conditions ? `Adverse environmental conditions (${inputs.weather_conditions})` : 'Communication gap between team supervisors'}, lack of secondary safety audits on active shift shifts.

## 8. CORRECTIVE AND PREVENTIVE ACTIONS (CAPA)
The safety compliance division prescribes the following actions:
1. **Immediate Cordoning (Target: 24 Hours):** Secure the affected incident zone with high-visibility hazard barricading.
2. **Toolbox Safety Meeting (Target: 48 Hours):** Conduct an emergency toolbox briefing highlighting site-specific hazards with all workers.
3. **Standard Operating Procedure Review (Target: 7 Days):** Update Job Safety Analysis (JSA) documents for ${inputs.incident_type} activities.`;
}

// --- API ROUTES ---

// 1. Get Preset Templates
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await db.all('SELECT * FROM template_presets');
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve templates: ' + err.message });
  }
});

// 2. Generate Incident Report
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  const {
    supervisor_name,
    supervisor_role,
    site_location,
    incident_timestamp,
    incident_type,
    severity_level,
    raw_description,
    weather_conditions,
    immediate_actions,
    witness_details
  } = req.body;

  // Basic validation
  if (!supervisor_name || !supervisor_role || !site_location || !incident_timestamp || !incident_type || !severity_level || !raw_description) {
    return res.status(400).json({ error: 'Missing required fields for incident report generation.' });
  }

  try {
    let reportMarkdown = '';
    let isMock = true;

    if (genAI) {
      try {
        isMock = false;
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-1.5-flash-latest',
          systemInstruction: `You are an expert Safety Director and Regulatory Compliance Auditor for Crownridge LLP, a heavy civil infrastructure construction firm. Your task is to generate a highly professional, structured, and audit-ready Safety Incident Report suitable for submission to regulatory safety bodies. Format the output strictly in clean Markdown using standard headers. Do not use creative adjectives or emotional language. Keep statements factual and precise.`
        });

        const prompt = `
Generate a structured safety incident report based on the following supervisor inputs:

Supervisor Name: ${supervisor_name}
Supervisor Designation/Role: ${supervisor_role}
Site Location: ${site_location}
Date/Time of Incident: ${incident_timestamp}
Incident Type: ${incident_type}
Severity Rating: ${severity_level}
Description of Incident: ${raw_description}
Weather Conditions: ${weather_conditions || 'Not reported'}
Immediate Actions Taken: ${immediate_actions || 'None reported'}
Witness Details: ${witness_details || 'None reported'}

Structure of the report MUST follow:
# CROWNRIDGE LLP - SAFETY INCIDENT REPORT
## 1. ADMINISTRATIVE INFORMATION
- **Report Reference:** CR-INC-${new Date().getFullYear()}-${generateShortId().substring(0, 5)}
- **Reporting Officer:** ${supervisor_name} (${supervisor_role})
- **Date/Time of Incident:** ${incident_timestamp}
- **Project Location/Site:** ${site_location}

## 2. INCIDENT CLASSIFICATION
- **Incident Type:** ${incident_type}
- **Severity Rating:** ${severity_level} (Specify operational impact)
- **Weather Conditions:** ${weather_conditions || 'Not Documented'}

## 3. INCIDENT DESCRIPTION
[Draft a chronological, objective narrative based on the description: "${raw_description}". Avoid guessing details; state what is known.]

## 4. IMMEDIATE RESPONSE & ACTIONS TAKEN
[Summarize immediate responses. If the user input was empty, detail standard procedure for medical/safety response.]

## 5. WITNESS OBSERVATIONS
[Document witness statements. If witness details are empty, state: "No direct eye-witnesses documented at immediate scene."]

## 6. REGULATORY & STANDARDS ANALYSIS
[Determine compliance standards. Reference relevant Indian Standard codes (e.g. IS 4912 for falls, IS 3764 for excavation) and BOCW safety guidelines.]

## 7. ROOT CAUSE ANALYSIS (RCA)
- **Direct Cause:** What triggered the event.
- **Indirect/Contributing Cause:** Environmental factors, communication gaps, or equipment failures.

## 8. CORRECTIVE AND PREVENTIVE ACTIONS (CAPA)
List 3-4 specific, actionable recommendations with targets:
1. Immediate site safety lockdown & inspection.
2. Mandatory retraining / toolbox meeting.
3. SOP updates.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        reportMarkdown = response.text();
      } catch (geminiErr) {
        console.error('Gemini API call failed, falling back to mock report:', geminiErr.message);
        isMock = true;
        reportMarkdown = generateMockReport(req.body) + `\n\n---\n\n> [!WARNING]\n> **AI Service Alert**: The live Google Gemini API returned a connection error ("${geminiErr.message}"). The report above was successfully generated using the local regulatory compliance templates for backup continuity. Please check your API Key configuration if this persists.`;
      }
    } else {
      // Fallback to local mock report generator
      reportMarkdown = generateMockReport(req.body);
    }

    const responseTimeMs = Date.now() - startTime;
    const reportId = 'rep-' + generateShortId();

    // Insert into DB
    await db.run(`
      INSERT INTO incident_reports (
        id, supervisor_name, supervisor_role, site_location, incident_timestamp, 
        incident_type, severity_level, raw_description, weather_conditions, 
        immediate_actions, witness_details, generated_report_markdown, 
        prompt_version, response_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportId, supervisor_name, supervisor_role, site_location, incident_timestamp,
      incident_type, severity_level, raw_description, weather_conditions || null,
      immediate_actions || null, witness_details || null, reportMarkdown,
      4, responseTimeMs
    ]);

    res.status(201).json({
      id: reportId,
      generated_report_markdown: reportMarkdown,
      response_time_ms: responseTimeMs,
      is_mock: isMock
    });

  } catch (err) {
    console.error('Generation API error:', err);
    res.status(500).json({ error: 'Failed to generate safety incident report: ' + err.message });
  }
});

// 3. Get Generation History
app.get('/api/history', async (req, res) => {
  try {
    const reports = await db.all(`
      SELECT r.id, r.supervisor_name, r.site_location, r.incident_timestamp, 
             r.incident_type, r.severity_level, r.created_at, f.rating_stars
      FROM incident_reports r
      LEFT JOIN feedback f ON r.id = f.report_id
      ORDER BY r.created_at DESC
    `);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history: ' + err.message });
  }
});

// 4. Get Report Details
app.get('/api/history/:id', async (req, res) => {
  try {
    const report = await db.get('SELECT * FROM incident_reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Incident report not found.' });
    }
    const feedback = await db.get('SELECT rating_stars, comments FROM feedback WHERE report_id = ?', [req.params.id]);
    res.json({ ...report, feedback: feedback || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report details: ' + err.message });
  }
});

// 5. Submit Quality Rating & Feedback
app.post('/api/feedback', async (req, res) => {
  const { report_id, rating_stars, comments } = req.body;
  if (!report_id || !rating_stars) {
    return res.status(400).json({ error: 'Missing report ID or star rating.' });
  }

  try {
    // Check if report exists
    const report = await db.get('SELECT id FROM incident_reports WHERE id = ?', [report_id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const feedbackId = 'fb-' + generateShortId();
    // Insert feedback or overwrite existing feedback for this report
    await db.run('DELETE FROM feedback WHERE report_id = ?', [report_id]);
    await db.run(`
      INSERT INTO feedback (id, report_id, rating_stars, comments)
      VALUES (?, ?, ?, ?)
    `, [feedbackId, report_id, rating_stars, comments || null]);

    res.status(201).json({ success: true, id: feedbackId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit feedback: ' + err.message });
  }
});

// 6. Admin Analytics
app.get('/api/admin/analytics', async (req, res) => {
  try {
    // Total generations
    const countRow = await db.get('SELECT COUNT(*) as total FROM incident_reports');
    const totalCount = countRow.total;

    // Average rating
    const ratingRow = await db.get('SELECT AVG(rating_stars) as avg_rating FROM feedback');
    const avgRating = ratingRow.avg_rating ? parseFloat(ratingRow.avg_rating.toFixed(2)) : 0;

    // Average response time
    const timeRow = await db.get('SELECT AVG(response_time_ms) as avg_time FROM incident_reports');
    const avgTime = timeRow.avg_time ? Math.round(timeRow.avg_time) : 0;

    // Severity breakdown
    const severities = await db.all(`
      SELECT severity_level, COUNT(*) as count 
      FROM incident_reports 
      GROUP BY severity_level
    `);
    const severityMap = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    severities.forEach(s => {
      if (severityMap[s.severity_level] !== undefined) {
        severityMap[s.severity_level] = s.count;
      }
    });

    // Rating distribution
    const ratings = await db.all(`
      SELECT rating_stars, COUNT(*) as count 
      FROM feedback 
      GROUP BY rating_stars
    `);
    const ratingMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(r => {
      if (ratingMap[r.rating_stars] !== undefined) {
        ratingMap[r.rating_stars] = r.count;
      }
    });

    // Top locations
    const locations = await db.all(`
      SELECT site_location, COUNT(*) as count 
      FROM incident_reports 
      GROUP BY site_location 
      ORDER BY count DESC 
      LIMIT 5
    `);

    // Quality trends over recent generations (last 10 ratings)
    const trends = await db.all(`
      SELECT r.created_at, f.rating_stars 
      FROM feedback f
      JOIN incident_reports r ON f.report_id = r.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `);

    res.json({
      total_generations: totalCount,
      average_rating: avgRating,
      average_response_time_ms: avgTime,
      severity_distribution: severityMap,
      rating_distribution: ratingMap,
      top_locations: locations,
      recent_feedback_trends: trends.reverse()
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to compute analytics: ' + err.message });
  }
});

// Catch-all route to serve the frontend for single-page routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

db.ready()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
