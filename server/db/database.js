import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'db.json');

// Entidades suportadas no sistema
const ENTITIES = [
  'CashMovement', 'CashRegister', 'Category', 'Commission',
  'ConciliationEntry', 'CostCenter', 'Customer', 'Employee',
  'Exchange', 'Expense', 'Product', 'Sale',
  'StockMovement', 'Store', 'Transaction', 'Transfer', 'User'
];

class Database {
  constructor() {
    this.data = {};
    this.load();
  }

  load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Erro ao ler db.json, reiniciando dados:', err);
        this.data = {};
      }
    }
    // Garante que todas as entidades existam
    for (const entity of ENTITIES) {
      if (!Array.isArray(this.data[entity])) {
        this.data[entity] = [];
      }
    }
    this.save();
  }

  save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getCollection(entityName) {
    if (!this.data[entityName]) {
      this.data[entityName] = [];
    }
    return this.data[entityName];
  }

  generateId() {
    return crypto.randomUUID();
  }

  // Operações de consulta
  list(entityName, sort = '-created_date', limit = 1000) {
    let items = [...this.getCollection(entityName)];
    return this.applySortAndLimit(items, sort, limit);
  }

  filter(entityName, criteria = {}, sort = '-created_date', limit = 1000) {
    let items = this.getCollection(entityName);

    items = items.filter(item => {
      return this.matchCriteria(item, criteria);
    });

    return this.applySortAndLimit(items, sort, limit);
  }

  get(entityName, id) {
    const items = this.getCollection(entityName);
    return items.find(i => String(i.id) === String(id)) || null;
  }

  create(entityName, data) {
    const items = this.getCollection(entityName);
    const now = new Date().toISOString();
    const newItem = {
      id: data.id || this.generateId(),
      ...data,
      created_date: data.created_date || now,
      updated_date: now
    };
    items.unshift(newItem);
    this.save();
    return newItem;
  }

  bulkCreate(entityName, dataArray) {
    if (!Array.isArray(dataArray)) return [];
    const created = dataArray.map(item => this.create(entityName, item));
    return created;
  }

  update(entityName, id, data) {
    const items = this.getCollection(entityName);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;

    const existing = items[index];
    const updated = {
      ...existing,
      ...data,
      id: existing.id,
      created_date: existing.created_date,
      updated_date: new Date().toISOString()
    };
    items[index] = updated;
    this.save();
    return updated;
  }

  delete(entityName, id) {
    const items = this.getCollection(entityName);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;

    items.splice(index, 1);
    this.save();
    return true;
  }

  // Avaliação de critérios de busca (suporta igualdade simples, $in, $or, $regex)
  matchCriteria(item, criteria) {
    for (const [key, val] of Object.entries(criteria)) {
      if (key === '$or' && Array.isArray(val)) {
        const orMatch = val.some(subCrit => this.matchCriteria(item, subCrit));
        if (!orMatch) return false;
        continue;
      }

      const itemVal = item[key];

      if (val && typeof val === 'object') {
        if (Array.isArray(val.$in)) {
          if (!val.$in.includes(itemVal)) return false;
        } else if (val.$regex) {
          const rx = new RegExp(val.$regex, val.$options || 'i');
          if (Array.isArray(itemVal)) {
            if (!itemVal.some(v => rx.test(String(v)))) return false;
          } else if (!rx.test(String(itemVal || ''))) {
            return false;
          }
        } else if (val.$exists !== undefined) {
          const exists = itemVal !== undefined && itemVal !== null;
          if (exists !== val.$exists) return false;
        }
      } else {
        if (String(itemVal) !== String(val)) {
          return false;
        }
      }
    }
    return true;
  }

  // Ordenação e limite
  applySortAndLimit(items, sort, limit) {
    if (sort) {
      const desc = sort.startsWith('-');
      const field = desc ? sort.slice(1) : sort;

      items.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (valA === undefined || valA === null) return desc ? 1 : -1;
        if (valB === undefined || valB === null) return desc ? -1 : 1;

        if (typeof valA === 'string') {
          return desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return desc ? valB - valA : valA - valB;
      });
    }

    if (limit && limit > 0) {
      return items.slice(0, Number(limit));
    }
    return items;
  }
}

export const db = new Database();
