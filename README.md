# Sistema CRM (MVP)

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2022-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-ISC-blue)

Sistema de **Gestão de Relacionamento com o Cliente (CRM)** em formato de MVP, composto por uma API REST e uma interface web, com um funil de vendas visual no estilo **Kanban**.

Projeto desenvolvido para a disciplina **Processo de Produção, Métrica e Qualidade de Software**.

---

## Sobre o projeto

### Propósito

Equipes comerciais costumam manter contatos, negociações e anotações espalhados entre planilhas, e-mails e mensagens. O objetivo deste projeto é **centralizar essas informações em uma única base** e dar visibilidade ao andamento das vendas.

Com o sistema, um vendedor consegue:

- cadastrar e qualificar contatos (leads e clientes);
- abrir oportunidades de negócio vinculadas a cada cliente;
- acompanhar e movimentar essas oportunidades pelas etapas do funil em um quadro Kanban;
- registrar o histórico de interações (ligações, reuniões, e-mails e notas);
- consultar indicadores de desempenho e exportar os dados em CSV.

### Contexto acadêmico

Além de entregar um produto funcional, o projeto serviu de objeto de estudo para práticas de engenharia de software cobradas na disciplina:

- escrita padronizada de **User Stories**, com regras de negócio, critérios de aceite em formato BDD, *Definition of Ready* e *Definition of Done*;
- estimativa de esforço pela **Matriz de Complexidade x Incerteza**, usando a escala de Fibonacci;
- planejamento incremental em **4 sprints semanais**, com 8 histórias de usuário (28 Story Points no total).

O backlog completo, o planejamento das sprints e a especificação refinada de cada história estão em [`documentacao_crm.md`](./documentacao_crm.md).

### Escopo do MVP

| Módulo | Resumo |
| :--- | :--- |
| Segurança e acesso | Login com e-mail e senha, sessão por token JWT (8 horas) |
| Gestão de carteira | Cadastro, listagem, busca, edição e qualificação de clientes |
| Funil de vendas | Oportunidades de negócio e quadro Kanban |
| Relacionamento | Histórico de interações por cliente (timeline) |
| Métricas | Dashboard com KPIs e exportação de relatório em CSV |

O detalhamento de cada funcionalidade e dos endpoints da API aparece na seção [Funcionalidades](#funcionalidades).

---

## Tecnologias utilizadas

| Camada | Tecnologia | Uso no projeto |
| :--- | :--- | :--- |
| Ambiente de execução | [Node.js](https://nodejs.org/) 22 ou superior | Executa o servidor |
| Servidor web / API | [Express](https://expressjs.com/) 5 | Rotas REST e entrega dos arquivos estáticos do front-end |
| Banco de dados | [SQLite](https://www.sqlite.org/) via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | Persistência local em arquivo (`crm.db`), sem necessidade de instalar um servidor de banco |
| Autenticação | [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) | Geração e validação dos tokens de sessão |
| Segurança de senhas | [`bcryptjs`](https://github.com/dcodeIO/bcrypt.js) | Hash das senhas (nunca armazenadas em texto puro) |
| Integração | [`cors`](https://github.com/expressjs/cors) | Liberação de requisições entre origens |
| Front-end | HTML, CSS e JavaScript puro | Interface em página única (`public/index.html`), sem framework |

> **Observação:** a documentação de engenharia sugere opções como React e Recharts na abordagem técnica das histórias. A implementação atual optou por uma interface simples em HTML/JS puro, incluindo um gráfico de barras desenhado com CSS, sem dependências adicionais no front-end.

---

## Como executar localmente

### Pré-requisitos

| Ferramenta | Versão | Como verificar |
| :--- | :--- | :--- |
| [Node.js](https://nodejs.org/) | **22 ou superior** (exigência do `better-sqlite3`) | `node -v` |
| npm | Já vem instalado com o Node.js | `npm -v` |
| [Git](https://git-scm.com/) | Qualquer versão recente (opcional, só para clonar) | `git --version` |

Não é necessário instalar nenhum banco de dados: o SQLite roda embutido na aplicação e os dados ficam em um arquivo local.

### Passo a passo

**1. Clone o repositório e entre na pasta do projeto**

```bash
git clone https://github.com/<EARNascimento>/sistema-crm.git
cd sistema-crm/crm-mvp
```

> Substitua `<seu-usuario>` pelo usuário (ou organização) dono do repositório. Se você baixou o `.zip` pelo GitHub, extraia-o e entre na pasta `crm-mvp`.

**2. Instale as dependências**

```bash
npm install
```

Se esse comando falhar com erros do `node-gyp`, veja a [solução de problemas](#solução-de-problemas) logo abaixo. Há uma alternativa simples.

**3. Inicie o servidor**

```bash
node server.js
```

O terminal deve exibir:

```text
Servidor CRM completo rodando em http://localhost:3000
```

**4. Acesse a aplicação**

Abra [http://localhost:3000](http://localhost:3000) no navegador. O próprio servidor entrega a interface e a API, então não há um segundo processo para iniciar.

Use o usuário de demonstração, criado automaticamente na primeira execução:

| Campo | Valor |
| :--- | :--- |
| E-mail | `admin@crm.com` |
| Senha | `123456` |

Para encerrar o servidor, pressione `Ctrl + C` no terminal.

### Banco de dados

- Na primeira execução, o arquivo **`crm.db`** é criado automaticamente com as tabelas `users`, `customers`, `deals` e `interactions`, além do usuário de demonstração. O banco começa sem clientes, oportunidades ou interações.
- O arquivo é criado **na pasta de onde o comando `node` foi executado**. Por isso, execute sempre de dentro de `crm-mvp`. Se você rodar `node crm-mvp/server.js` a partir da raiz do repositório, um segundo `crm.db` será criado na raiz e você terá dois bancos diferentes sem perceber.
- **Para zerar os dados:** pare o servidor, apague o arquivo `crm.db` (e, se existirem, `crm.db-wal` e `crm.db-shm`) e inicie o servidor novamente.

### Configurações fixas no código

Esta versão do MVP não usa variáveis de ambiente. Os valores abaixo ficam no início do `server.js`:

| Configuração | Valor atual | Observação |
| :--- | :--- | :--- |
| Porta | `3000` | Para mudar, edite a constante `PORT` |
| Segredo do JWT | definido no código (`JWT_SECRET`) | Adequado apenas para demonstração; veja [Limitações conhecidas](#limitações-conhecidas) |

### Solução de problemas

| Sintoma | Causa provável | O que fazer |
| :--- | :--- | :--- |
| `npm install` falha com erros de `node-gyp` ou tenta compilar o `better-sqlite3` | Com o `package-lock.json` do repositório, o npm pode tentar compilar o módulo nativo em vez de usar o binário pré-compilado que o pacote já traz. A compilação exige Python e um compilador C++ e acesso à internet | Rode `npm install --ignore-scripts`. Nenhuma outra dependência do projeto precisa de script de instalação, e o `better-sqlite3` funciona normalmente com o binário que acompanha o pacote |
| Erro ao iniciar mencionando versão do Node ou módulo nativo incompatível | Node.js anterior à versão 22 | Atualize o Node.js, apague a pasta `node_modules` e rode `npm install` novamente |
| O terminal mostra "rodando em http://localhost:3000", mas o sistema não reflete suas alterações ou parece ser outra versão | A porta 3000 já está em uso por outra instância do servidor ou por outro programa. O código imprime a mensagem de sucesso mesmo quando não consegue abrir a porta | Feche a instância anterior (ou o programa que usa a porta) e inicie novamente. Também é possível trocar a constante `PORT` |
| Os clientes e negócios cadastrados "sumiram" depois de iniciar o servidor de outra pasta | Um novo `crm.db` (vazio, apenas com o usuário demo) foi criado no outro diretório | Execute sempre de dentro de `crm-mvp` e, se necessário, localize o `crm.db` original |
| A API responde `401` depois de várias horas de uso | O token JWT vale 8 horas | Faça login novamente |
<!-- ETAPA 3: Funcionalidades e referência da API -->
<!-- ETAPA 5: Estrutura do projeto, modelo de dados, limitações e próximos passos -->