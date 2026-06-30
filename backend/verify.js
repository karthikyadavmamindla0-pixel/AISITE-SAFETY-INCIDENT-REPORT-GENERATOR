const prisma = require('./database/prisma');
const { hashPassword, generateSalt } = require('./utils/helpers');

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING SAFETY REPORT GENERATOR LOCAL VERIFICATION');
  console.log('  (PRISMA ORM & MVC REFACTORED DATABASE)');
  console.log('====================================================');
  console.log('\nTesting Database Connection...');

  try {
    await prisma.$connect();
    console.log('[PASS] Prisma database client connected successfully.');

    // 1. Verify template presets table exists and contains seeded data
    const presets = await prisma.templatePreset.findMany();
    console.log(`[PASS] template_presets table checked. Found ${presets.length} records.`);
    
    if (presets.length !== 3) {
      throw new Error(`Expected 3 presets, but found ${presets.length}`);
    }
    
    presets.forEach((p, idx) => {
      console.log(`       - Preset ${idx + 1}: "${p.preset_name}" (${p.incident_type})`);
    });

    // 1b. Verify user authentication database operations
    console.log('\nTesting Authentication Database Operations...');
    const testUserId = 'test-usr-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const testUsername = 'testuser_' + Math.random().toString(36).substr(2, 5);
    const testPassword = 'testpassword123';
    const testFullName = 'Test Full Name';
    const testUserRole = 'Test Engineer';

    // Verify hashing helpers
    const salt = generateSalt();
    const hash = hashPassword(testPassword, salt);
    if (!salt || !hash || hash.length !== 128) {
      throw new Error('Password hashing verification failed.');
    }
    console.log('[PASS] Password hashing functions validated successfully.');

    // Verify user insertion
    await prisma.user.create({
      data: {
        id: testUserId,
        username: testUsername,
        password_hash: hash,
        salt: salt,
        full_name: testFullName,
        role: testUserRole
      }
    });
    console.log(`[PASS] Successfully inserted test user (ID: ${testUserId}, Username: ${testUsername}).`);

    // Verify user retrieval and password verification
    const fetchedUser = await prisma.user.findUnique({
      where: { username: testUsername }
    });
    if (!fetchedUser) {
      throw new Error('Test user could not be retrieved from DB.');
    }
    const computedHash = hashPassword(testPassword, fetchedUser.salt);
    if (computedHash !== fetchedUser.password_hash) {
      throw new Error('Retrieved user password hash validation failed.');
    }
    console.log('[PASS] Successfully retrieved user and validated password hash.');

    // Verify session creation
    const testToken = 'test-tok-' + Math.random().toString(36).substr(2, 10).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    await prisma.session.create({
      data: {
        token: testToken,
        user_id: testUserId,
        expires_at: expiresAt
      }
    });
    console.log('[PASS] Successfully created session token for test user.');

    // Verify session retrieval and user join
    const sessionWithUser = await prisma.session.findUnique({
      where: { token: testToken },
      include: { user: true }
    });
    if (!sessionWithUser || sessionWithUser.user.username !== testUsername) {
      throw new Error('Failed to retrieve session and join corresponding user.');
    }
    console.log(`[PASS] Session retrieval and user relationship check passed for username: ${sessionWithUser.user.username}.`);

    // Clean up test user & session
    await prisma.session.delete({ where: { token: testToken } });
    await prisma.user.delete({ where: { id: testUserId } });
    console.log('[PASS] Test user and session cleanup completed successfully.');

    // 2. Verify we can insert an incident report
    const testId = 'test-rep-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    
    await prisma.incidentReport.create({
      data: {
        id: testId,
        supervisor_name: 'Test Supervisor',
        supervisor_role: 'Test Officer',
        incident_title: 'Near Miss (No Injury)',
        location: 'Test Location Block C',
        incident_date: '2026-06-27T10:00',
        severity: 'Low',
        incident_description: 'This is a local verification test description that should be at least fifteen characters long.',
        weather_conditions: 'Clear',
        immediate_actions: 'None',
        witness_details: 'None',
        ai_generated_report: '# TEST REPORT\nThis is a mock report content.',
        response_time_ms: 120
      }
    });
    console.log(`[PASS] Successfully inserted test incident report (ID: ${testId}).`);

    // 3. Verify we can fetch the inserted report
    const fetched = await prisma.incidentReport.findUnique({
      where: { id: testId }
    });
    if (!fetched) {
      throw new Error('Inserted report could not be retrieved from DB.');
    }
    console.log(`[PASS] Successfully retrieved incident report from database.`);
    console.log(`       - Location: ${fetched.location}`);
    console.log(`       - Title/Type: ${fetched.incident_title}`);
    console.log(`       - Severity: ${fetched.severity}`);

    // 4. Verify we can submit feedback rating
    const testFeedbackId = 'test-fb-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    await prisma.feedback.create({
      data: {
        id: testFeedbackId,
        report_id: testId,
        rating_stars: 5,
        comments: 'Verified successfully.'
      }
    });
    console.log(`[PASS] Successfully inserted feedback rating for test report.`);

    // 5. Verify feedback joins correctly
    const reportWithFeedback = await prisma.incidentReport.findUnique({
      where: { id: testId },
      include: { feedbacks: true }
    });
    if (!reportWithFeedback || reportWithFeedback.feedbacks[0].rating_stars !== 5) {
      throw new Error('Failed to join report feedback correctly.');
    }
    console.log(`[PASS] Database relationship check passed: rating joined correctly.`);

    // Clean up test report and feedback
    await prisma.incidentReport.delete({
      where: { id: testId }
    });
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
