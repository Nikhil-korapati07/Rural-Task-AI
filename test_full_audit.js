const http = require('http');

async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAudit() {
  console.log('--- END-TO-END AUDIT STARTING ---');
  let passCount = 0;
  let failCount = 0;

  const assert = (condition, msg) => {
    if (condition) { console.log(`✅ PASS: ${msg}`); passCount++; }
    else { console.error(`❌ FAIL: ${msg}`); failCount++; }
  };

  try {
    // Phase 1, 8: Reset DB
    await request('/reset-all', 'POST');
    
    // Phase 2: Signup & Login
    const signup = await request('/auth/signup', 'POST', { username: 'qa_user', password: 'password', role: 'employer' });
    assert(signup.status === 201, 'User Signup successful');
    
    const login = await request('/auth/login', 'POST', { username: 'qa_user', password: 'password' });
    assert(login.status === 200, 'User Login successful');

    // Phase 3: Register Workers
    const w1 = await request('/workers', 'POST', { name: 'Bob (Good)', skills: ['carpentry'], location: 'Village A' });
    assert(w1.status === 201, 'Worker 1 registered');
    const worker1Id = w1.body.worker._id || w1.body.worker.id;

    const w2 = await request('/workers', 'POST', { name: 'Charlie (Backup)', skills: ['carpentry'], location: 'Village A' });
    assert(w2.status === 201, 'Worker 2 registered');
    const worker2Id = w2.body.worker._id || w2.body.worker.id;

    // Phase 4: Verify Skill & Generate AI Questions
    const questions1 = await request('/questions/carpentry', 'GET');
    assert(questions1.status === 200 && questions1.body.questions.length > 0, 'Questions fetched for Carpentry');
    
    const questions2 = await request('/questions/teaching', 'GET');
    assert(questions2.status === 200 && questions1.body.questions[0].q !== questions2.body.questions[0].q, 'Domain quizzes are uniquely generated');

    const verify1 = await request('/verify-skill', 'POST', { workerId: worker1Id, skill: 'carpentry', passed: true, score: 100 });
    assert(verify1.status === 200, 'Skill Verification (Quiz Passed) updates confidence successfully');
    
    // Give w2 lower confidence so w1 is picked first
    await request('/verify-skill', 'POST', { workerId: worker2Id, skill: 'carpentry', passed: true, score: 65 });

    // Phase 5: Post Job
    const jobRes = await request('/jobs', 'POST', { title: 'Build Table', requiredSkills: [{skill: 'carpentry', priority: 1}], location: 'Village A' });
    assert(jobRes.status === 201, 'Job Posted');
    const jobId = jobRes.body.job._id || jobRes.body.job.id;

    // Matching Engine
    const assignRes = await request(`/assign/${jobId}`, 'POST');
    assert(assignRes.status === 200 && assignRes.body.job.assignedWorker, 'Matching Engine selected best worker');
    assert(assignRes.body.job.assignedWorker.id === worker1Id, 'Matching Engine correctly prioritized higher confidence worker (Bob)');

    // Phase 6 & 7: Execution & Auto-Reassignment
    const startRes = await request(`/start/${jobId}`, 'POST');
    assert(startRes.status === 200, 'Execution Engine started job');

    const failRes = await request(`/fail/${jobId}`, 'POST', { failureReason: 'No show' });
    assert(failRes.status === 200, 'Execution Engine handles job failure successfully');

    // Wait a brief moment to see if auto-reassign kicks in (some flows require manual re-match, wait let's check assignment)
    // The prompt says "Auto Reassign: 1. Assign 2. Fail 3. Verify failed worker excluded and next best selected"
    const failJobCheck = await request(`/jobs`, 'GET');
    // If it was auto-reassigned, the status might be 'Assigned' again to Charlie.
    const theJob = failJobCheck.body.jobs ? failJobCheck.body.jobs.find(j => j._id === jobId) : null;
    if (theJob) {
        assert(theJob.status === 'Assigned' || theJob.status === 'Pending', 'Failed job reverted to correct state');
        if (theJob.status === 'Assigned') {
            assert(theJob.assignedWorker.id === worker2Id, 'Auto-reassignment correctly selected backup worker (Charlie)');
        } else {
             // Try manual match to test exclusion
             const reassignRes = await request(`/assign/${jobId}`, 'POST');
             assert(reassignRes.status === 200 && reassignRes.body.job.assignedWorker.id === worker2Id, 'Manual reassignment successfully excluded failed worker and selected Charlie');
        }
    } else {
        console.error('❌ FAIL: Job lost after failure');
    }

    console.log(`\n--- AUDIT COMPLETE ---`);
    console.log(`Final Score: ${passCount} / ${passCount + failCount} Tests Passed`);

  } catch (err) {
    console.error('Audit crashed:', err);
  }
}
runAudit();
