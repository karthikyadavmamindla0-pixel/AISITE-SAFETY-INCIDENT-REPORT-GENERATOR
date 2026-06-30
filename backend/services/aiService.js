const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateShortId } = require('../utils/helpers');
const logger = require('../utils/logger');

let genAI = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    logger.info('Gemini AI initialized successfully in aiService.');
  } catch (err) {
    logger.error('Failed to initialize Gemini AI in aiService', err);
  }
}

function generateMockReport(inputs) {
  const year = new Date().getFullYear();
  const shortId = Math.random().toString(36).substr(2, 5).toUpperCase();
  const refId = `CR-INC-${year}-${shortId}`;
  
  return `# CROWNRIDGE LLP - SAFETY INCIDENT REPORT
## 1. ADMINISTRATIVE INFORMATION
- **Report Reference:** ${refId}
- **Reporting Officer:** ${inputs.supervisor_name} (${inputs.supervisor_role || 'Supervisor'})
- **Date/Time of Incident:** ${inputs.incident_timestamp || inputs.incident_date}
- **Project Location/Site:** ${inputs.site_location || inputs.location}

## 2. INCIDENT CLASSIFICATION
- **Incident Type:** ${inputs.incident_type || inputs.incident_title}
- **Severity Rating:** ${inputs.severity_level || inputs.severity} (Requires local site safety review)
- **Weather Conditions:** ${inputs.weather_conditions || 'Not Documented'}

## 3. INCIDENT DESCRIPTION
On ${inputs.incident_timestamp || inputs.incident_date}, a safety incident classified as **${inputs.incident_type || inputs.incident_title}** occurred at the **${inputs.site_location || inputs.location}** project site.
**Incident Narrative:**
"${inputs.raw_description || inputs.incident_description}"

This incident was flagged with a severity rating of **${inputs.severity_level || inputs.severity}** by reporting supervisor ${inputs.supervisor_name}.

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
3. **Standard Operating Procedure Review (Target: 7 Days):** Update Job Safety Analysis (JSA) documents for ${inputs.incident_type || inputs.incident_title} activities.`;
}

async function generateAIReport(inputs) {
  const supervisor_name = inputs.supervisor_name;
  const supervisor_role = inputs.supervisor_role || 'Supervisor';
  const site_location = inputs.site_location || inputs.location;
  const incident_timestamp = inputs.incident_timestamp || inputs.incident_date;
  const incident_type = inputs.incident_type || inputs.incident_title;
  const severity_level = inputs.severity_level || inputs.severity;
  const raw_description = inputs.raw_description || inputs.incident_description;
  const weather_conditions = inputs.weather_conditions || 'Not reported';
  const immediate_actions = inputs.immediate_actions || 'None reported';
  const witness_details = inputs.witness_details || 'None reported';

  let reportMarkdown = '';
  let isMock = true;

  if (genAI) {
    try {
      isMock = false;
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
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
Weather Conditions: ${weather_conditions}
Immediate Actions Taken: ${immediate_actions}
Witness Details: ${witness_details}

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
- **Weather Conditions:** ${weather_conditions}

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
      logger.error('Gemini API call failed, falling back to mock report:', geminiErr);
      isMock = true;
      reportMarkdown = generateMockReport(inputs) + `\n\n---\n\n> [!WARNING]\n> **AI Service Alert**: The live Google Gemini API returned an error ("${geminiErr.message}"). The report above was successfully generated using the local regulatory compliance templates for backup continuity. Please check your API Key configuration if this persists.`;
    }
  } else {
    reportMarkdown = generateMockReport(inputs);
  }

  return {
    reportMarkdown,
    isMock
  };
}

module.exports = {
  generateAIReport,
  generateMockReport
};
