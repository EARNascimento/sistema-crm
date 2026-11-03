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

const db = new Database('crm.db');

// Inicialização das Tabelas (Etapa 1 + Etapa 2)
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

  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    stage TEXT DEFAULT 'PROSPECCAO',
    customer_id INTEGER NOT NULL,
    expected_close_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

// Seed inicial do Usuário
const seedUser = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@crm.com');
if (!seedUser) {
  const hash = bcrypt.hashSync('123456', 10);
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
    'Vendedor Demo',
    'admin@crm.com',
    hash
  );
}

// Middleware JWT (US01)
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

// --- US01: Autenticação ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha e-mail e senha' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: '8h',
  });

  return res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// --- US02 & US03: Listagem com Busca/Filtro, Cadastro e Edição de Clientes ---
app.get('/api/customers', authMiddleware, (req, res) => {
  const { search, status } = req.query;
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  // RN02 US03: Busca textual por Nome, E-mail ou Empresa (case-insensitive)
  if (search && search.trim() !== '') {
    query += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  // RN01 US03: Filtro por Status
  if (status && status.trim() !== '') {
    query += ' AND status = ?';
    params.push(status.trim());
  }

  query += ' ORDER BY created_at DESC, id DESC';
  const customers = db.prepare(query).all(...params);
  return res.status(200).json(customers);
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const { name, email, phone, company, role } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
  }

  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Já existe um cliente cadastrado com este e-mail.' });
  }

  const stmt = db.prepare(`
    INSERT INTO customers (name, email, phone, company, role, status)
    VALUES (?, ?, ?, ?, ?, 'LEAD')
  `);
  const result = stmt.run(name, email, phone, company || '', role || '');

  const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(newCustomer);
});

// US03: Atualização de Cliente e Qualificação de Status
app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, email, phone, company, role, status } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
  }

  // RN01 US03: Status permitidos
  const allowedStatus = ['LEAD', 'ATIVO', 'INATIVO'];
  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use LEAD, ATIVO ou INATIVO.' });
  }

  // Verifica se o e-mail pertence a outro cliente
  const existing = db.prepare('SELECT id FROM customers WHERE email = ? AND id != ?').get(email, id);
  if (existing) {
    return res.status(409).json({ error: 'Este e-mail já está em uso por outro cliente.' });
  }

  const stmt = db.prepare(`
    UPDATE customers
    SET name = ?, email = ?, phone = ?, company = ?, role = ?, status = ?
    WHERE id = ?
  `);
  const info = stmt.run(name, email, phone, company || '', role || '', status || 'LEAD', id);

  if (info.changes === 0) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  return res.status(200).json(updated);
});

// --- US04: Gestão de Oportunidades Comerciais (Negócios) ---
app.get('/api/deals', authMiddleware, (req, res) => {
  // Abordagem Técnica US04: JOIN com nome do cliente
  const deals = db.prepare(`
    SELECT d.*, c.name as customer_name, c.company as customer_company
    FROM deals d
    JOIN customers c ON d.customer_id = c.id
    ORDER BY d.created_at DESC, d.id DESC
  `).all();
  return res.status(200).json(deals);
});

app.post('/api/deals', authMiddleware, (req, res) => {
  const { title, value, customer_id, expected_close_date } = req.body;

  if (!title || value === undefined || value === '' || !customer_id) {
    return res.status(400).json({ error: 'Título, Valor e Cliente são obrigatórios.' });
  }

  // RN02 US04: Valor numérico >= 0
  const numericValue = Number(value);
  if (isNaN(numericValue) || numericValue < 0) {
    return res.status(400).json({ error: 'O valor estimado deve ser numérico e maior ou igual a zero.' });
  }

  // RN01 US04: Cliente deve existir no banco
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
  if (!customer) {
    return res.status(404).json({ error: 'Cliente vinculado não encontrado.' });
  }

  // RN03 US04: Toda oportunidade inicia em PROSPECCAO
  const stmt = db.prepare(`
    INSERT INTO deals (title, value, stage, customer_id, expected_close_date)
    VALUES (?, ?, 'PROSPECCAO', ?, ?)
  `);
  const result = stmt.run(title.trim(), numericValue, customer_id, expected_close_date || null);

  const newDeal = db.prepare(`
    SELECT d.*, c.name as customer_name
    FROM deals d
    JOIN customers c ON d.customer_id = c.id
    WHERE d.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(newDeal);
});

app.listen(PORT, () => {
  console.log(`Servidor CRM rodando em http://localhost:${PORT}`);
});