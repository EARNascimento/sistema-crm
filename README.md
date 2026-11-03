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

<!-- ETAPA 2: Como rodar na sua máquina (instalação e execução) -->
<!-- ETAPA 3: Funcionalidades e referência da API -->
<!-- ETAPA 5: Estrutura do projeto, modelo de dados, limitações e próximos passos -->