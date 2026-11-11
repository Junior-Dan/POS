import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Set test environment variables
const TEST_DB = `/tmp/test_cf_worker_${Date.now()}.db`;
process.env.USE_LOCAL_DB = '1';
process.env.CELLAR_DB_PATH = TEST_DB;
process.env.NODE_ENV = 'test';

const worker = (await import('../worker/index.js')).default;

// Mock Cloudflare Worker ASSETS binding
const mockAssets = {
  fetch: async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/index.html' || url.pathname === '/dashboard') {
      return new Response('<!DOCTYPE html><html><body>Cellar POS SPA</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' }
      });
    }
    return new Response('Asset Not Found', { status: 404 });
  }
};

const mockEnv = {
  JWT_SECRET: 'test-jwt-secret-for-cf-workers-migration-1234567890',
  SUPABASE_URL: 'https://test-supabase-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  ASSETS: mockAssets
};

async function workerRequest(method, pathname, body = null, token = null) {
  const headers = new Headers();
  if (body) {
    headers.set('content-type', 'application/json');
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const req = new Request(`https://cellarpos.com${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const res = await worker.fetch(req, mockEnv, {});
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, body: data };
}

let testCount = 0;
let passCount = 0;

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

console.log('\n=== CLOUDFLARE WORKER INTEGRATION TEST SUITE ===\n');

try {
  // 1. Worker Configuration & Environment Binding
  await test('Cloudflare Worker populates runtime environment bindings into process.env', async () => {
    const res = await workerRequest('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(process.env.JWT_SECRET, mockEnv.JWT_SECRET);
    assert.equal(process.env.SUPABASE_URL, mockEnv.SUPABASE_URL);
    assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, mockEnv.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(process.env.CLOUDFLARE_WORKER, '1');
  });

  // 2. Health Endpoint
  await test('GET /api/health returns ok status', async () => {
    const res = await workerRequest('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.match(res.body.message, /Cellar POS API Engine/i);
  });

  // 3. Auth Setup (First-time business owner registration)
  let ownerToken = null;
  let ownerUser = null;
  await test('POST /api/auth/setup registers the business owner and initializes DB', async () => {
    const res = await workerRequest('POST', '/api/auth/setup', {
      name: 'Alice Owner',
      email: 'alice@cellar.test',
      phone: '0711000222',
      password: 'OwnerPassword123!',
      confirmPassword: 'OwnerPassword123!',
      businessName: 'Cellar POS Flagship Store'
    });
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.ok(res.body.token, 'Token must be returned on setup');
    assert.equal(res.body.user.role, 'owner');
    assert.equal(res.body.user.name, 'Alice Owner');
    ownerToken = res.body.token;
    ownerUser = res.body.user;
  });

  // 4. Owner Login
  await test('POST /api/auth/login authenticates owner with email & password', async () => {
    const res = await workerRequest('POST', '/api/auth/login', {
      email: 'alice@cellar.test',
      password: 'OwnerPassword123!'
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'alice@cellar.test');
    assert.equal(res.body.user.role, 'owner');
    ownerToken = res.body.token;
  });

  // 5. Staff Creation & RBAC
  let cashierToken = null;
  let cashierUser = null;
  let tempPassword = null;
  await test('POST /api/auth/users allows owner to create cashier account', async () => {
    const res = await workerRequest('POST', '/api/auth/users', {
      name: 'Bob Cashier',
      email: 'bob@cellar.test',
      role: 'cashier'
    }, ownerToken);
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.ok(res.body.temporaryPassword);
    tempPassword = res.body.temporaryPassword;
    cashierUser = res.body.user;
  });

  // 6. Cashier Login
  await test('POST /api/auth/login authenticates cashier using temporary password', async () => {
    const res = await workerRequest('POST', '/api/auth/login', {
      email: 'bob@cellar.test',
      password: tempPassword
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'cashier');
    cashierToken = res.body.token;
  });

  // 7. Protected Route Without Auth
  await test('Unauthenticated API requests are rejected with 401', async () => {
    const res = await workerRequest('GET', '/api/products');
    assert.equal(res.status, 401);
    assert.ok(res.body.error);
  });

  // 8. Products Management
  let productId = null;
  await test('POST /api/products creates product in inventory', async () => {
    const res = await workerRequest('POST', '/api/products', {
      name: 'Highland Single Malt 12YO',
      brand: 'Highland',
      category: 'Whisky',
      price: 4500,
      cost: 3200,
      stock: 50,
      sku: 'WKY-SM-12',
      barcode: '6001234567890'
    }, ownerToken);
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.ok(res.body.id);
    productId = res.body.id;
  });

  await test('GET /api/products returns product list to cashier and owner', async () => {
    const res = await workerRequest('GET', '/api/products', null, cashierToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find(p => p.id === productId);
    assert.ok(found, 'Created product must be in product list');
    assert.equal(found.name, 'Highland Single Malt 12YO');
    assert.equal(Number(found.selling_price || found.price), 4500);
  });

  // 9. Sales Processing: Cash Sale
  await test('POST /api/sales completes a cash transaction and decrements stock', async () => {
    const res = await workerRequest('POST', '/api/sales', {
      items: [{ id: productId, name: 'Highland Single Malt 12YO', qty: 2, price: 4500 }],
      subtotal: 9000,
      discount: 0,
      tax: 1440,
      total: 9000,
      paymentMethod: 'CASH',
      clientRef: 'CF-SALE-CASH-1'
    }, cashierToken);
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.ok(res.body.sale);
    assert.ok(res.body.sale.receiptNo);
    assert.equal(res.body.sale.paymentMethod, 'CASH');
    assert.equal(Number(res.body.sale.total), 9000);

    // Verify stock decremented by 2 (50 - 2 = 48)
    const prods = await workerRequest('GET', '/api/products', null, ownerToken);
    const prod = prods.body.find(p => p.id === productId);
    assert.equal(Number(prod.current_stock ?? prod.stock), 48);
  });

  // 10. Sales Processing: M-Pesa Sale
  await test('POST /api/sales completes an M-Pesa transaction with code validation', async () => {
    // Missing M-Pesa code should fail
    const failRes = await workerRequest('POST', '/api/sales', {
      items: [{ id: productId, name: 'Highland Single Malt 12YO', qty: 1, price: 4500 }],
      subtotal: 4500,
      discount: 0,
      tax: 720,
      total: 4500,
      paymentMethod: 'M-PESA',
      clientRef: 'CF-SALE-MP-FAIL'
    }, cashierToken);
    assert.equal(failRes.status, 400);

    // With valid M-Pesa code
    const res = await workerRequest('POST', '/api/sales', {
      items: [{ id: productId, name: 'Highland Single Malt 12YO', qty: 1, price: 4500 }],
      subtotal: 4500,
      discount: 0,
      tax: 720,
      total: 4500,
      paymentMethod: 'M-PESA',
      mpesaCode: 'QWE123RTY9',
      clientRef: 'CF-SALE-MP-1'
    }, cashierToken);
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.equal(res.body.sale.mpesaCode, 'QWE123RTY9');
    assert.equal(Number(res.body.sale.total), 4500);

    // Verify stock decremented by 1 (48 - 1 = 47)
    const prods = await workerRequest('GET', '/api/products', null, ownerToken);
    const prod = prods.body.find(p => p.id === productId);
    assert.equal(Number(prod.current_stock ?? prod.stock), 47);
  });

  // 11. Reports & Dashboard
  await test('GET /api/reports/dashboard aggregates cash + M-Pesa revenue accurately', async () => {
    const res = await workerRequest('GET', '/api/reports/dashboard', null, ownerToken);
    assert.equal(res.status, 200);
    const dash = res.body;
    assert.equal(dash.totalTransactions, 2);
    assert.equal(Number(dash.todayRevenue), 13500); // 9000 + 4500
    assert.equal(Number(dash.todayCashSales), 9000);
    assert.equal(Number(dash.todayMpesaSales), 4500);
  });

  // 12. Non-existent API route 404
  await test('Non-existent API route returns 404 JSON', async () => {
    const res = await workerRequest('GET', '/api/nonexistent-route-xyz');
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  // 13. Static Assets & Single-Page Application (SPA) routing
  await test('Worker delegates non-API frontend route to ASSETS binding (SPA fallback)', async () => {
    const res = await workerRequest('GET', '/dashboard');
    assert.equal(res.status, 200);
    assert.match(res.body, /Cellar POS SPA/);
  });

  console.log(`\n───────────────────────────────────────────────`);
  console.log(`ALL TESTS PASSED: ${passCount} / ${testCount} verified successfully!`);
  console.log(`───────────────────────────────────────────────\n`);
} finally {
  try {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  } catch {}
}
