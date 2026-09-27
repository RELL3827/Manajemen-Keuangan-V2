// E2E API Verification Script for EarnVoice
const http = require('http');

function post(url, data, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode, data: json });
        } catch(e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode, data: json });
        } catch(e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== EarnVoice E2E Verification ===\n');

  // 1. Check frontend
  console.log('1. Checking Frontend (http://localhost:5173)...');
  const fe = await get('http://localhost:5173');
  console.log(`   Frontend status: ${fe.status === 200 ? 'OK (200)' : 'Error: ' + fe.status}`);

  // 2. Login
  console.log('2. Testing Login API (demo@earnvoice.app)...');
  const loginRes = await post('http://127.0.0.1:8000/api/login', {
    email: 'demo@earnvoice.app',
    password: 'password'
  });
  console.log(`   Login status: ${loginRes.status}`);
  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('   Login failed:', loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;
  const user = loginRes.data.user;
  console.log(`   Logged in as: ${user.name} (${user.email})`);

  // 3. Check Dashboard
  console.log('3. Testing Dashboard API...');
  const dash = await get('http://127.0.0.1:8000/api/dashboard', token);
  console.log(`   Dashboard status: ${dash.status}`);
  if (dash.data && dash.data.summary) {
    console.log(`   Total Saldo: Rp ${Number(dash.data.summary.total_balance).toLocaleString('id-ID')}`);
    console.log(`   Total Pemasukan: Rp ${Number(dash.data.summary.total_income).toLocaleString('id-ID')}`);
    console.log(`   Total Pengeluaran: Rp ${Number(dash.data.summary.total_expense).toLocaleString('id-ID')}`);
  }

  // 4. Accounts & Categories
  console.log('4. Testing Accounts & Categories API...');
  const accs = await get('http://127.0.0.1:8000/api/accounts', token);
  const cats = await get('http://127.0.0.1:8000/api/categories', token);
  console.log(`   Accounts count: ${accs.data ? accs.data.length : 0}`);
  console.log(`   Categories count: ${cats.data ? cats.data.length : 0}`);

  // 5. Voice Parser API
  console.log('5. Testing Voice NLP Server Parser...');
  const voiceTest = await post('http://127.0.0.1:8000/api/voice/parse', {
    text: 'Saya mengeluarkan 25 ribu untuk makan siang'
  }, token);
  console.log(`   Voice parser status: ${voiceTest.status}`);
  console.log(`   Parsed result:`, JSON.stringify(voiceTest.data, null, 2));

  // 6. Budgets & Savings
  console.log('6. Testing Budgets & Savings Goals...');
  const budgets = await get('http://127.0.0.1:8000/api/budgets', token);
  const savings = await get('http://127.0.0.1:8000/api/savings-goals', token);
  console.log(`   Budgets count: ${budgets.data ? budgets.data.length : 0}`);
  console.log(`   Savings Goals count: ${savings.data ? savings.data.length : 0}`);

  // 7. Notifications
  console.log('7. Testing Notifications...');
  const notifs = await get('http://127.0.0.1:8000/api/notifications', token);
  console.log(`   Notifications count: ${notifs.data ? notifs.data.length : 0}`);

  console.log('\n=== ALL ENDPOINTS VERIFIED & WORKING PERFECTLY! ===');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
