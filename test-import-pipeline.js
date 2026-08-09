import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function request(endpoint, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Iniciando Suíte de Testes para Importação de Produtos (PDF, CSV, Excel)...\n');
  let passed = 0;
  let failed = 0;
  let authToken = '';

  // 1. Test Health / Server
  try {
    const health = await request('/api/health');
    if (health.status === 200) {
      console.log('✅ Server Health Check: OK');
      passed++;
    } else {
      console.error('❌ Server Health Check Failed:', health);
      failed++;
    }
  } catch (err) {
    console.error('❌ Server não está rodando na porta 3001. Erro:', err.message);
    process.exit(1);
  }

  // 1b. Login to obtain Auth Token
  try {
    const loginRes = await request('/api/auth/login', 'POST', {
      email: 'superadmin@andresweb.com',
      password: '123456'
    });
    if (loginRes.status === 200 && loginRes.body.token) {
      authToken = loginRes.body.token;
      console.log('✅ Autenticação (Login Admin): OK');
      passed++;
    } else {
      console.error('❌ Login Falhou:', loginRes);
      failed++;
    }
  } catch (err) {
    console.error('❌ Erro no login:', err.message);
    failed++;
  }

  const authHeaders = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};

  // 2. Test CSV Import via /api/import-ai
  try {
    const csvContent = "nome,categoria,preco,custo,estoque,sku\nCamisa Linho Branca,Camisas,149.90,60.00,10,CAM-LIN-01\nShort Jeans Blue,Shorts,99.90,40.00,15,SHO-JNS-02";
    const resCsv = await request('/api/import-ai', 'POST', {
      mode: 'products',
      raw_text: csvContent
    }, authHeaders);

    if (resCsv.status === 200 && resCsv.body.items?.length === 2) {
      console.log('✅ Importação CSV via /api/import-ai: OK (2 produtos extraídos)');
      passed++;
    } else {
      console.error('❌ Importação CSV Falhou:', resCsv);
      failed++;
    }
  } catch (err) {
    console.error('❌ Erro no teste de CSV:', err.message);
    failed++;
  }

  // 3. Test XLSX Import via /api/import-ai
  try {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["nome", "categoria", "preco", "custo", "estoque", "sku"],
      ["Vestido Longo Boho", "Vestidos", 250.00, 110.00, 5, "VEST-BOHO-01"],
      ["Blusa Tricot Oversized", "Blusas", 120.00, 50.00, 8, "BLU-TRI-02"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const xlsxBase64 = xlsxBuffer.toString('base64');

    const resXlsx = await request('/api/import-ai', 'POST', {
      mode: 'products',
      file_base64: xlsxBase64,
      file_name: 'test_products.xlsx'
    }, authHeaders);

    if (resXlsx.status === 200 && resXlsx.body.items?.length === 2) {
      console.log('✅ Importação XLSX via /api/import-ai: OK (2 produtos extraídos)');
      passed++;
    } else {
      console.error('❌ Importação XLSX Falhou:', resXlsx);
      failed++;
    }
  } catch (err) {
    console.error('❌ Erro no teste de XLSX:', err.message);
    failed++;
  }

  // 4. Test PDF Import via /api/import-ai (using jsPDF)
  try {
    const doc = new jsPDF();
    doc.text("Jaqueta Couro Biker\t399.90\t180.00\t4\tCasacos\tPreto\tG\tJAQ-COU-01", 10, 20);
    doc.text("Macacão Pantalona\t220.00\t90.00\t7\tMacacões\tAzul\tM\tMAC-PAN-02", 10, 30);
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    const pdfBase64 = pdfBuffer.toString('base64');

    const resPdf = await request('/api/import-ai', 'POST', {
      mode: 'products',
      file_base64: pdfBase64,
      file_name: 'test_products.pdf'
    }, authHeaders);

    if (resPdf.status === 200 && resPdf.body.items?.length >= 2) {
      console.log(`✅ Importação PDF via /api/import-ai: OK (${resPdf.body.items.length} produtos extraídos)`);
      passed++;
    } else {
      console.error('❌ Importação PDF Falhou:', resPdf);
      failed++;
    }
  } catch (err) {
    console.error('❌ Erro no teste de PDF:', err.message);
    failed++;
  }

  // 5. Test Saving to Database (Product.bulkCreate and StockMovement.bulkCreate)
  try {
    const productsToSave = [
      {
        name: 'Produto Teste Automático A',
        category: 'Vestidos',
        price: 199.90,
        cost_price: 89.90,
        reference: 'REF-TEST-001',
        store_id: 'store-demo-1',
        variants: [{ size: 'M', color: 'Rosa', stock: 15, sku: 'TEST-PROD-A' }],
        is_active: true
      },
      {
        name: 'Produto Teste Automático B',
        category: 'Blusas',
        price: 89.90,
        cost_price: 35.00,
        reference: 'REF-TEST-002',
        store_id: 'store-demo-1',
        variants: [{ size: 'P', color: 'Branco', stock: 20, sku: 'TEST-PROD-B' }],
        is_active: true
      }
    ];

    const resSaveProd = await request('/api/entities/Product/bulk', 'POST', productsToSave, authHeaders);

    if (resSaveProd.status === 200 && Array.isArray(resSaveProd.body) && resSaveProd.body.length === 2) {
      console.log('✅ Gravação no Banco de Dados (Product.bulkCreate): OK (2 produtos salvos)');
      passed++;

      const movements = resSaveProd.body.map(p => ({
        product_id: p.id,
        product_name: p.name,
        variant_size: 'M',
        variant_color: 'Rosa',
        store_id: 'store-demo-1',
        type: 'entrada',
        quantity: 15,
        reason: 'Teste Automático de Importação'
      }));

      const resSaveMov = await request('/api/entities/StockMovement/bulk', 'POST', movements, authHeaders);

      if (resSaveMov.status === 200 && Array.isArray(resSaveMov.body) && resSaveMov.body.length === 2) {
        console.log('✅ Gravação no Banco de Dados (StockMovement.bulkCreate): OK (2 movimentações de estoque registradas)');
        passed++;
      } else {
        console.error('❌ Gravação de StockMovement Falhou:', resSaveMov);
        failed++;
      }

    } else {
      console.error('❌ Gravação de Product Falhou:', resSaveProd);
      failed++;
    }
  } catch (err) {
    console.error('❌ Erro no teste de gravação no banco:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`📊 Resultado dos Testes: ${passed} PASSOU | ${failed} FALHOU`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
