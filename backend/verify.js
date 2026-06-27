const db = require('./database');

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING SAFETY REPORT GENERATOR LOCAL VERIFICATION');
  console.log('====================================================');
  console.log('\nTesting Database Operations...');

  try {
    await db.ready();
    // 1. Verify template presets table exists and contains seeded data
    const presets = await db.all('SELECT * FROM template_presets');
    console.log(`[PASS] template_presets table checked. Found ${presets.length} records.`);
    
    if (presets.length !== 3) {
      throw new Error(`Expected 3 presets, but found ${presets.length}`);
    }
    
    presets.forEach((p, idx) => {
      console.log(`       - Preset ${idx + 1}: "${p.preset_name}" (${p.incident_type})`);
    });

    // 2. Verify we can insert an incident report
    const testId = 'test-rep-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const testReport = {
      id: testId,
      supervisor_name: 'Test Supervisor',
      supervisor_role: 'Test Officer',
      site_location: 'Test Location Block C',
      incident_timestamp: '2026-06-27T10:00',
      incident_type: 'Near Miss (No Injury)',
      severity_level: 'Low',
      raw_description: 'This is a local verification test description that should be at least fifteen characters long.',
      weather_conditions: 'Clear',
      immediate_actions: 'None',
      witness_details: 'None',
      generated_report_markdown: '# TEST REPORT\nThis is a mock report content.',
      prompt_version: 4,
      response_time_ms: 120
    };

    await db.run(`
      INSERT INTO incident_reports (
        id, supervisor_name, supervisor_role, site_location, incident_timestamp,
        incident_type, severity_level, raw_description, weather_conditions,
        immediate_actions, witness_details, generated_report_markdown,
        prompt_version, response_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testReport.id, testReport.supervisor_name, testReport.supervisor_role, 
      testReport.site_location, testReport.incident_timestamp, testReport.incident_type, 
      testReport.severity_level, testReport.raw_description, testReport.weather_conditions,
      testReport.immediate_actions, testReport.witness_details, testReport.generated_report_markdown,
      testReport.prompt_version, testReport.response_time_ms
    ]);
    console.log(`[PASS] Successfully inserted test incident report (ID: ${testId}).`);

    // 3. Verify we can fetch the inserted report
    const fetched = await db.get('SELECT * FROM incident_reports WHERE id = ?', [testId]);
    if (!fetched) {
      throw new Error('Inserted report could not be retrieved from DB.');
    }
    console.log(`[PASS] Successfully retrieved incident report from database.`);
    console.log(`       - Location: ${fetched.site_location}`);
    console.log(`       - Type: ${fetched.incident_type}`);
    console.log(`       - Severity: ${fetched.severity_level}`);

    // 4. Verify we can submit feedback rating
    const testFeedbackId = 'test-fb-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await db.run(`
      INSERT INTO feedback (id, report_id, rating_stars, comments)
      VALUES (?, ?, ?, ?)
    `, [testFeedbackId, testId, 5, 'Verified successfully.']);
    console.log(`[PASS] Successfully inserted feedback rating for test report.`);

    // 5. Verify feedback joins correctly
    const reportWithFeedback = await db.get(`
      SELECT r.id, f.rating_stars, f.comments
      FROM incident_reports r
      LEFT JOIN feedback f ON r.id = f.report_id
      WHERE r.id = ?
    `, [testId]);
    if (!reportWithFeedback || reportWithFeedback.rating_stars !== 5) {
      throw new Error('Failed to join report feedback correctly.');
    }
    console.log(`[PASS] Database relationship check passed: rating joined correctly.`);

    // Clean up test report and feedback
    await db.run('DELETE FROM feedback WHERE report_id = ?', [testId]);
    await db.run('DELETE FROM incident_reports WHERE id = ?', [testId]);
    console.log('[PASS] Test cleanup completed successfully.');
    
    console.log('\n====================================================');
    console.log('  ALL LOCAL VERIFICATION TESTS PASSED SUCCESSFULLY!  ');
    console.log('====================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n[FAIL] Verification Test Failed:', err.message);
    process.exit(1);
  }
}

// Allow database initialization to print its messages before running tests
setTimeout(runTests, 1000);
