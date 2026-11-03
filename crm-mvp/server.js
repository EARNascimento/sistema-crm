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

// Inicialização das Tabelas (Etapas 1, 2 e 3)
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

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed inicial do Utilizador
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

// --- US02 & US03: Clientes ---
app.get('/api/customers', authMiddleware, (req, res) => {
  const { search, status } = req.query;
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (search && search.trim() !== '') {
    query += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

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

app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, email, phone, company, role, status } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
  }

  const allowedStatus = ['LEAD', 'ATIVO', 'INATIVO'];
  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use LEAD, ATIVO ou INATIVO.' });
  }

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

// --- US04 & US05: Oportunidades e Movimentação do Pipeline (Kanban) ---
app.get('/api/deals', authMiddleware, (req, res) => {
  const deals = db.prepare(`
    SELECT d.*, c.name as customer_name, c.company as customer_company, c.status as customer_status
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

  const numericValue = Number(value);
  if (isNaN(numericValue) || numericValue < 0) {
    return res.status(400).json({ error: 'O valor estimado deve ser numérico e maior ou igual a zero.' });
  }

  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
  if (!customer) {
    return res.status(404).json({ error: 'Cliente vinculado não encontrado.' });
  }

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

// US05: Atualização de estágio no Kanban com Transação Atómica (RN01 e RN02)
app.patch('/api/deals/:id/stage', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { stage } = req.body;

  const allowedStages = [
    'PROSPECCAO',
    'QUALIFICACAO',
    'PROPOSTA',
    'NEGOCIACAO',
    'FECHADO_GANHO',
    'FECHADO_PERDIDO'
  ];

  if (!stage || !allowedStages.includes(stage)) {
    return res.status(400).json({ error: 'Estágio do funil inválido.' });
  }

  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!deal) {
    return res.status(404).json({ error: 'Oportunidade não encontrada.' });
  }

  // Abordagem Técnica US05: Transaction atómica para atualizar oportunidade + converter LEAD -> ATIVO
  const updateStageTransaction = db.transaction((dealId, newStage, customerId) => {
    db.prepare('UPDATE deals SET stage = ? WHERE id = ?').run(newStage, dealId);

    let convertedLead = false;
    if (newStage === 'FECHADO_GANHO') {
      const cust = db.prepare('SELECT status FROM customers WHERE id = ?').get(customerId);
      if (cust && cust.status === 'LEAD') {
        db.prepare("UPDATE customers SET status = 'ATIVO' WHERE id = ?").run(customerId);
        convertedLead = true;
      }
    }
    return convertedLead;
  });

  const convertedLead = updateStageTransaction(id, stage, deal.customer_id);
  const updatedDeal = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);

  return res.status(200).json({
    deal: updatedDeal,
    convertedLead
  });
});

// --- US06: Histórico de Interações e Follow-up (Timeline) ---
app.get('/api/customers/:id/interactions', authMiddleware, (req, res) => {
  const { id } = req.params;

  // RN02 US06: Ordenação cronológica reversa (do mais recente para o mais antigo)
  const interactions = db.prepare(`
    SELECT i.*, u.name as author_name
    FROM interactions i
    JOIN users u ON i.user_id = u.id
    WHERE i.customer_id = ?
    ORDER BY i.created_at DESC, i.id DESC
  `).all(id);

  return res.status(200).json(interactions);
});

app.post('/api/customers/:id/interactions', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { type, description } = req.body;

  // RN01 US06: Tipo válido e descrição obrigatória
  const allowedTypes = ['LIGACAO', 'REUNIAO', 'EMAIL', 'NOTA'];
  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Tipo de interação inválido. Use LIGACAO, REUNIAO, EMAIL ou NOTA.' });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'A descrição da interação é obrigatória.' });
  }

  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  const stmt = db.prepare(`
    INSERT INTO interactions (customer_id, user_id, type, description)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(id, req.user.id, type, description.trim());

  const newInteraction = db.prepare(`
    SELECT i.*, u.name as author_name
    FROM interactions i
    JOIN users u ON i.user_id = u.id
    WHERE i.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(newInteraction);
});

app.listen(PORT, () => {
  console.log(`Servidor CRM rodando em http://localhost:${PORT}`);
});