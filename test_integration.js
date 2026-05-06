const http = require('http');

const API_BASE = 'http://localhost:3000';

async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Integration Tests ---');
  
  try {
    // 1. Reset Database
    console.log('Resetting DB...');
    await request('/reset-all', 'POST');
    
    // 2. Signup
    console.log('Testing Signup...');
    const signupRes = await request('/auth/signup', 'POST', { username: 'testuser', password: 'password', role: 'employer' });
    console.log('Signup Status:', signupRes.status);
    
    // 3. Login
    console.log('Testing Login...');
    const loginRes = await request('/auth/login', 'POST', { username: 'testuser', password: 'password' });
    console.log('Login Status:', loginRes.status);
    
    // 4. Create Worker
    console.log('Testing Create Worker...');
    const workerRes = await request('/workers', 'POST', { name: 'Alice', skills: ['carpentry', 'teaching'], location: 'Village A' });
    console.log('Worker Status:', workerRes.status);
    const workerId = workerRes.body.worker ? workerRes.body.worker._id || workerRes.body.worker.id : null;
    console.log('Worker ID:', workerId);
    
    // 5. Create Job
    console.log('Testing Create Job...');
    const jobRes = await request('/jobs', 'POST', { 
        title: 'Build a desk', 
        requiredSkills: [{skill: 'carpentry', priority: 1}], 
        location: 'Village A' 
    });
    console.log('Job Status:', jobRes.status);
    const jobId = jobRes.body.job ? jobRes.body.job._id : null;
    
    // 6. Fetch Quiz Questions (Static / Fallback)
    console.log('Testing Get Questions...');
    const qRes = await request('/questions/carpentry', 'GET');
    console.log('Questions Status:', qRes.status, 'Count:', qRes.body.questions ? qRes.body.questions.length : 0);
    
    // 7. Fetch AI Quiz Questions (Forced)
    console.log('Testing Forced AI Questions...');
    const aiQRes = await request('/questions/carpentry?force=true', 'GET');
    console.log('AI Questions Status:', aiQRes.status, 'Count:', aiQRes.body.questions ? aiQRes.body.questions.length : 0);
    
    // 8. Assign Job
    console.log('Testing Assign Job...');
    const assignRes = await request(`/assign/${jobId}`, 'POST');
    console.log('Assign Job Status:', assignRes.status);
    
    // 9. Start Job
    console.log('Testing Start Job...');
    const startRes = await request(`/start/${jobId}`, 'POST');
    console.log('Start Job Status:', startRes.status);
    
    // 10. Fail Job
    console.log('Testing Fail Job...');
    const failRes = await request(`/fail/${jobId}`, 'POST', { failureReason: 'Delay' });
    console.log('Fail Job Status:', failRes.status);
    
    console.log('--- Tests Completed ---');
  } catch (err) {
    console.error('Test script encountered an error:', err);
  }
}

runTests();
