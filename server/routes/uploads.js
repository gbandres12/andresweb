import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

// Extrair dados de arquivo (NFe / PDF Mock / Fallback)
router.post('/api/integrations/Core/ExtractDataFromUploadedFile', (req, res) => {
  res.json({
    output: []
  });
});

export default router;
