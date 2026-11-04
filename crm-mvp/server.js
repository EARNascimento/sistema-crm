const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'chave_secreta_crm_mvp_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Caminho absoluto previsível (Resolve Ponto 3 e ambientes de nuvem/Vercel)
const DB_FILE = process.env.VERCEL 
  ? path.join('/tmp', 'crm_data.json') 
  : path.join(__dirname, 'crm_data.json');

// Estrutura de Banco de Dados Local em JS Puro (Sem dependência nativa de C++)
let db = {
  users: [],
  customers: [],
  deals: [],
  interactions: [],
  counters: { users: 0, customers: 0, deals: 0, interactions: 0 }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
    }
  } catch (err) {
    console.error('Iniciando base em memória');
  }

  // Seed do usuário inicial (US01)
  if (!db.users.find(u => u.email === 'admin@crm.com')) {
    db.counters.users++;
    db.users.push({
      id: db.counters.users,
      name: 'Vendedor Demo',
      email: 'admin@crm.com',
      password_hash: bcrypt.hashSync('123456', 10),
      created_at: new Date().toISOString()
    });
    saveDatabase();
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    // Em ambientes estritamente read-only, os dados persistem na memória da instância
  }
}

loadDatabase();

// Middleware de Autenticação JWT (US01)
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

  const user = db.users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: '8h'
  });

  return res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

// --- US02 & US03: Clientes ---
app.get('/api/customers', authMiddleware, (req, res) => {
  const { search, status } = req.query;
  let list = [...db.customers];

  if (search && search.trim() !== '') {
    const term = search.trim().toLowerCase();
    list = list.filter(c => 
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.company && c.company.toLowerCase().includes(term))
    );
  }

  if (status && status.trim() !== '') {
    list = list.filter(c => c.status === status.trim());
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  return res.status(200).json(list);
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const { name, email, phone, company, role } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
  }

  const existing = db.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Já existe um cliente cadastrado com este e-mail.' });
  }

  db.counters.customers++;
  const newCustomer = {
    id: db.counters.customers,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    company: company ? company.trim() : '',
    role: role ? role.trim() : '',
    status: 'LEAD',
    created_at: new Date().toISOString()
  };

  db.customers.push(newCustomer);
  saveDatabase();
  return res.status(201).json(newCustomer);
});

app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, email, phone, company, role, status } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
  }

  const allowedStatus = ['LEAD', 'ATIVO', 'INATIVO'];
  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use LEAD, ATIVO ou INATIVO.' });
  }

  const customerIndex = db.customers.findIndex(c => c.id === id);
  if (customerIndex === -1) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  const existingOther = db.customers.find(c => c.email.toLowerCase() === email.toLowerCase() && c.id !== id);
  if (existingOther) {
    return res.status(409).json({ error: 'Este e-mail já está em uso por outro cliente.' });
  }

  db.customers[customerIndex] = {
    ...db.customers[customerIndex],
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    company: company ? company.trim() : '',
    role: role ? role.trim() : '',
    status: status || db.customers[customerIndex].status
  };

  saveDatabase();
  return res.status(200).json(db.customers[customerIndex]);
});

// --- US04 & US05: Oportunidades e Kanban ---
app.get('/api/deals', authMiddleware, (req, res) => {
  const dealsWithCustomer = db.deals.map(d => {
    const cust = db.customers.find(c => c.id === d.customer_id) || {};
    return {
      ...d,
      customer_name: cust.name || 'Cliente Removido',
      customer_company: cust.company || '',
      customer_status: cust.status || ''
    };
  });

  dealsWithCustomer.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  return res.status(200).json(dealsWithCustomer);
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

  const customer = db.customers.find(c => c.id === Number(customer_id));
  if (!customer) {
    return res.status(404).json({ error: 'Cliente vinculado não encontrado.' });
  }

  db.counters.deals++;
  const newDeal = {
    id: db.counters.deals,
    title: title.trim(),
    value: numericValue,
    stage: 'PROSPECCAO',
    customer_id: Number(customer_id),
    expected_close_date: expected_close_date || null,
    created_at: new Date().toISOString()
  };

  db.deals.push(newDeal);
  saveDatabase();

  return res.status(201).json({
    ...newDeal,
    customer_name: customer.name
  });
});

app.patch('/api/deals/:id/stage', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
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

  const dealIndex = db.deals.findIndex(d => d.id === id);
  if (dealIndex === -1) {
    return res.status(404).json({ error: 'Oportunidade não encontrada.' });
  }

  db.deals[dealIndex].stage = stage;

  let convertedLead = false;
  if (stage === 'FECHADO_GANHO') {
    const custIndex = db.customers.findIndex(c => c.id === db.deals[dealIndex].customer_id);
    if (custIndex !== -1 && db.customers[custIndex].status === 'LEAD') {
      db.customers[custIndex].status = 'ATIVO';
      convertedLead = true;
    }
  }

  saveDatabase();

  return res.status(200).json({
    deal: db.deals[dealIndex],
    convertedLead
  });
});

// --- US06: Histórico de Interações (Timeline) ---
app.get('/api/customers/:id/interactions', authMiddleware, (req, res) => {
  const customerId = parseInt(req.params.id, 10);
  const items = db.interactions
    .filter(i => i.customer_id === customerId)
    .map(i => {
      const user = db.users.find(u => u.id === i.user_id) || {};
      return {
        ...i,
        author_name: user.name || 'Usuário'
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);

  return res.status(200).json(items);
});

app.post('/api/customers/:id/interactions', authMiddleware, (req, res) => {
  const customerId = parseInt(req.params.id, 10);
  const { type, description } = req.body;

  const allowedTypes = ['LIGACAO', 'REUNIAO', 'EMAIL', 'NOTA'];
  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Tipo de interação inválido. Use LIGACAO, REUNIAO, EMAIL ou NOTA.' });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'A descrição da interação é obrigatória.' });
  }

  const customer = db.customers.find(c => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  db.counters.interactions++;
  const newInteraction = {
    id: db.counters.interactions,
    customer_id: customerId,
    user_id: req.user.id,
    type,
    description: description.trim(),
    created_at: new Date().toISOString()
  };

  db.interactions.push(newInteraction);
  saveDatabase();

  return res.status(201).json({
    ...newInteraction,
    author_name: req.user.name
  });
});

// --- US07: Dashboard Gerencial ---
app.get('/api/dashboard/summary', authMiddleware, (req, res) => {
  const totalCustomers = db.customers.length;

  const allStages = [
    'PROSPECCAO',
    'QUALIFICACAO',
    'PROPOSTA',
    'NEGOCIACAO',
    'FECHADO_GANHO',
    'FECHADO_PERDIDO'
  ];

  const byStage = {};
  allStages.forEach(st => {
    byStage[st] = { count: 0, total_value: 0 };
  });

  db.deals.forEach(d => {
    if (byStage[d.stage]) {
      byStage[d.stage].count++;
      byStage[d.stage].total_value += Number(d.value || 0);
    }
  });

  const wonRevenue = byStage['FECHADO_GANHO'].total_value;
  const openPipeline =
    byStage['PROSPECCAO'].total_value +
    byStage['QUALIFICACAO'].total_value +
    byStage['PROPOSTA'].total_value +
    byStage['NEGOCIACAO'].total_value;

  const wonCount = byStage['FECHADO_GANHO'].count;
  const lostCount = byStage['FECHADO_PERDIDO'].count;
  const totalFinished = wonCount + lostCount;
  const conversionRate = totalFinished > 0 ? Number(((wonCount / totalFinished) * 100).toFixed(2)) : 0;

  return res.status(200).json({
    totalCustomers,
    openPipeline,
    wonRevenue,
    conversionRate,
    wonCount,
    lostCount,
    byStage
  });
});

// --- US08: Exportação CSV ---
app.get('/api/reports/export', authMiddleware, (req, res) => {
  const rows = [];
  db.customers.forEach(c => {
    const custDeals = db.deals.filter(d => d.customer_id === c.id);
    if (custDeals.length === 0) {
      rows.push({
        customer_id: c.id,
        customer_name: c.name,
        customer_email: c.email,
        customer_phone: c.phone,
        customer_company: c.company,
        customer_role: c.role,
        customer_status: c.status,
        deal_id: null,
        deal_title: null,
        deal_value: null,
        deal_stage: null,
        deal_close_date: null
      });
    } else {
      custDeals.forEach(d => {
        rows.push({
          customer_id: c.id,
          customer_name: c.name,
          customer_email: c.email,
          customer_phone: c.phone,
          customer_company: c.company,
          customer_role: c.role,
          customer_status: c.status,
          deal_id: d.id,
          deal_title: d.title,
          deal_value: d.value,
          deal_stage: d.stage,
          deal_close_date: d.expected_close_date
        });
      });
    }
  });

  return res.status(200).json(rows);
});

// Entrega o index.html na rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento explícito de porta ocupada (Resolve Ponto 2)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`Servidor CRM rodando em http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[ERRO] A porta ${PORT} já está ocupada por outro processo.`);
      console.error(`Finalize o processo anterior antes de iniciar novamente.`);
      process.exit(1);
    } else {
      console.error('Erro no servidor:', err);
      process.exit(1);
    }
  });
}

// Export para o runtime Serverless da Vercel
module.exports = app;