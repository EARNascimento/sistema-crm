const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'chave_secreta_crm_mvp_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicialização do Banco de Dados SQLite
const db = new Database('crm.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    company TEXT,
    role TEXT,
    status TEXT DEFAULT 'LEAD',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed inicial: Usuário padrão para demonstração (RN01 US01: Senha com hash)
const seedUser = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@crm.com');
if (!seedUser) {
  const hash = bcrypt.hashSync('123456', 10);
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
    'Vendedor Demo',
    'admin@crm.com',
    hash
  );
}

// Middleware de Autenticação JWT (RN02 e RN03 US01)
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

// --- ROTAS US01: Autenticação ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha e-mail e senha' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // CA02 US01: Mensagem genérica com status 401 sem revelar qual campo errou
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  // RN02 US01: Expiração em 8 horas
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: '8h',
  });

  return res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// --- ROTAS US02: Cadastro e Listagem de Clientes ---
app.get('/api/customers', authMiddleware, (req, res) => {
  // Ordenado por created_at DESC conforme Abordagem Técnica da US02
  const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC, id DESC').all();
  return res.status(200).json(customers);
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const { name, email, phone, company, role } = req.body;

  // RN01 US02: Nome, E-mail e Telefone obrigatórios
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
  }

  // RN02 e CA02 US02: E-mail único retornando 409 Conflict
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Já existe um cliente cadastrado com este e-mail.' });
  }

  // RN03 US02: Todo novo cadastro nasce como LEAD
  const stmt = db.prepare(`
    INSERT INTO customers (name, email, phone, company, role, status)
    VALUES (?, ?, ?, ?, ?, 'LEAD')
  `);
  const result = stmt.run(name, email, phone, company || '', role || '');

  const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(newCustomer);
});

app.listen(PORT, () => {
  console.log(`Servidor CRM rodando em http://localhost:${PORT}`);
});