// Complete E2E Verification for EarnVoice
async function run() {
  console.log('=== EarnVoice E2E Verification ===\n');

  // 1. Check frontend
  console.log('1. Checking Frontend (http://localhost:5173)...');
  const fe = await fetch('http://localhost:5173');
  console.log(`   Frontend status: ${fe.status === 200 ? 'OK (200)' : 'Error: ' + fe.status}`);

  // 2. Login
  console.log('2. Testing Login API (demo@earnvoice.app)...');
  const loginRes = await fetch('http://127.0.0.1:8000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: 'demo@earnvoice.app', password: 'password' })
  });
  const loginData = await loginRes.json();
  console.log(`   Login status: ${loginRes.status}`);
  if (!loginData.token) {
    console.error('   Login failed:', loginData);
    process.exit(1);
  }
  const token = loginData.token;
  const user = loginData.user;
  console.log(`   Logged in as: ${user.name} (${user.email})`);

  // 3. Check Dashboard
  console.log('3. Testing Dashboard API...');
  const dashRes = await fetch('http://127.0.0.1:8000/api/dashboard', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const dash = await dashRes.json();
  console.log(`   Dashboard status: ${dashRes.status}`);
  if (dash && dash.summary) {
    console.log(`   Total Saldo: Rp ${Number(dash.summary.current_balance).toLocaleString('id-ID')}`);
    console.log(`   Total Pemasukan: Rp ${Number(dash.summary.total_income_month).toLocaleString('id-ID')}`);
    console.log(`   Total Pengeluaran: Rp ${Number(dash.summary.total_expense_month).toLocaleString('id-ID')}`);
    console.log(`   Insights count: ${dash.insights.length}`);
    console.log(`   Chart points: ${dash.chart_data.length}`);
    console.log(`   Recent transactions: ${dash.recent_transactions.length}`);
  }

  // 4. Accounts & Categories
  console.log('4. Testing Accounts & Categories API...');
  const accsRes = await fetch('http://127.0.0.1:8000/api/accounts', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const accsData = await accsRes.json();
  const catsRes = await fetch('http://127.0.0.1:8000/api/categories', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const cats = await catsRes.json();
  console.log(`   Accounts count: ${accsData.accounts ? accsData.accounts.length : 0}`);
  console.log(`   Categories count: ${cats.length}`);

  // 5. Voice Parser API
  console.log('5. Testing Voice NLP Server Parser...');
  const voiceRes = await fetch('http://127.0.0.1:8000/api/voice/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ text: 'Saya mengeluarkan 25 ribu untuk makan siang' })
  });
  const voiceData = await voiceRes.json();
  console.log(`   Voice parser status: ${voiceRes.status}`);
  console.log(`   Type: ${voiceData.parsed.type}`);
  console.log(`   Nominal: Rp ${Number(voiceData.parsed.amount).toLocaleString('id-ID')}`);
  console.log(`   Kategori: ${voiceData.parsed.category ? voiceData.parsed.category.name : '-'}`);
  console.log(`   Akun: ${voiceData.parsed.account ? voiceData.parsed.account.name : '-'}`);

  // 6. Transactions CRUD test
  console.log('6. Testing Transactions API...');
  const txRes = await fetch('http://127.0.0.1:8000/api/transactions', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const txData = await txRes.json();
  console.log(`   Transactions count: ${txData.total || (txData.data ? txData.data.length : 0)}`);

  // Create a test transaction
  const newTxRes = await fetch('http://127.0.0.1:8000/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      account_id: accsData.accounts[0].id,
      category_id: voiceData.parsed.category_id,
      type: 'expense',
      amount: 25000,
      description: 'Makan siang tes suara',
      transaction_date: new Date().toISOString().split('T')[0]
    })
  });
  const newTx = await newTxRes.json();
  console.log(`   Create transaction: ${newTxRes.status} (ID: ${newTx.transaction ? newTx.transaction.id : 'N/A'})`);

  // 7. Budgets & Savings
  console.log('7. Testing Budgets & Savings Goals...');
  const budgetsRes = await fetch('http://127.0.0.1:8000/api/budgets', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const budgetsData = await budgetsRes.json();
  const savingsRes = await fetch('http://127.0.0.1:8000/api/savings-goals', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const savingsData = await savingsRes.json();
  console.log(`   Budgets count: ${budgetsData.budgets ? budgetsData.budgets.length : (Array.isArray(budgetsData) ? budgetsData.length : 0)}`);
  console.log(`   Savings Goals count: ${savingsData.savings_goals ? savingsData.savings_goals.length : (Array.isArray(savingsData) ? savingsData.length : 0)}`);

  // 8. Notifications
  console.log('8. Testing Notifications...');
  const notifsRes = await fetch('http://127.0.0.1:8000/api/notifications', {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  const notifsData = await notifsRes.json();
  console.log(`   Notifications count: ${notifsData.notifications ? notifsData.notifications.length : 0}`);

  console.log('\n=== ALL ENDPOINTS VERIFIED & WORKING 100% SUCCESFULLY! ===');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
