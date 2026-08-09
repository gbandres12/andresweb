import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import importAiHandler from '../../api/import-ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });
const router = express.Router();

// Serve arquivos estáticos de upload
router.use('/uploads', express.static(UPLOAD_DIR));

// Upload de Arquivo
router.post('/api/integrations/Core/UploadFile', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const file_url = `/uploads/${req.file.filename}`;
    res.json({ file_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invocar LLM (Mock / Fallback)
router.post('/api/integrations/Core/InvokeLLM', (req, res) => {
  res.json({
    text: 'Descrição gerada automaticamente para o produto.',
    raw_response: {}
  });
});

// Extração IA via Rota /api/import-ai (Registrado para ambiente local)
router.post('/api/import-ai', importAiHandler);

// Extrair dados de arquivo (NFe / PDF / CSV / XLSX)
router.post('/api/integrations/Core/ExtractDataFromUploadedFile', async (req, res) => {
  try {
    const { file_url } = req.body || {};
    let file_base64 = '';
    let file_name = '';

    if (file_url) {
      const relativePath = file_url.replace('/uploads/', '');
      const fullPath = path.join(UPLOAD_DIR, relativePath);
      if (fs.existsSync(fullPath)) {
        const fileBuf = fs.readFileSync(fullPath);
        file_base64 = fileBuf.toString('base64');
        file_name = relativePath;
      }
    }

    // Mock handler response simulation for ExtractDataFromUploadedFile
    const reqMock = {
      method: 'POST',
      body: {
        mode: 'products',
        file_base64,
        file_name
      },
      setHeader: () => {}
    };

    const resMock = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json({
            status: 'success',
            output: data.items || []
          });
        }
      })
    };

    await importAiHandler(reqMock, resMock);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message, output: [] });
  }
});

export default router;
