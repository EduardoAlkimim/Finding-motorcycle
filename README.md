# 🏍️ AutoParts Tracker

Sistema de rastreamento de entregas para autopeças.
GPS físico nas motos · Painel web para despachante · App mobile para motoqueiro · Dashboard admin.

---

## Estrutura do projeto

```
Projeto_Entrega/
├── backend/                  → API Node.js + Express
│   ├── src/
│   │   ├── server.js         → entrada da aplicação
│   │   ├── controllers/      → lógica de cada recurso
│   │   ├── routes/           → endpoints da API
│   │   ├── middlewares/      → autenticação JWT
│   │   ├── services/         → Traccar, WebSocket, OSRM, geofence
│   │   └── prisma/           → schema do banco + seed
│   ├── .env.example          → variáveis de ambiente (copie para .env)
│   └── Dockerfile
├── frontend/                 → React + Vite (já entregue)
├── docker/
│   └── traccar.xml           → configuração do servidor GPS
├── docker-compose.yml        → sobe tudo junto
├── .gitignore
└── README.md
```

---

## Pré-requisitos

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git

---

## Como rodar pela primeira vez

### 1. Clone o projeto

```bash
git clone <url-do-repositorio>
cd Projeto_Entrega
```

### 2. Configure o .env do backend

```bash
cd backend
cp .env.example .env
```

Abra o `.env` e ajuste se precisar. Para desenvolvimento local não precisa mudar nada.

### 3. Suba o banco e o Traccar com Docker

```bash
# Na raiz do Projeto_Entrega
docker-compose up -d postgres traccar
```

Aguarde ~20 segundos para o PostgreSQL iniciar.

### 4. Configure o banco de dados

```bash
cd backend
npm install
npx prisma migrate dev --name init
node src/prisma/seed.js
```

O seed cria os usuários de teste, motos e locais automaticamente.

### 5. Rode o backend

```bash
npm run dev
```

Backend disponível em: **http://localhost:3000**

### 6. Rode o frontend (em outro terminal)

```bash
cd ../frontend
npm install
npm run dev
```

Frontend disponível em: **http://localhost:5173**

---

## Usuários de teste

| Perfil       | E-mail                        | Senha  |
|--------------|-------------------------------|--------|
| Admin        | admin@autopecas.com           | 123456 |
| Despachante  | despachante@autopecas.com     | 123456 |
| Motoqueiro 1 | moto1@autopecas.com           | 123456 |
| Motoqueiro 2 | moto2@autopecas.com           | 123456 |

---

## Simular GPS sem o tracker físico

Enquanto o tracker J16 não chegar, você testa assim:

**Opção 1 — App no celular (recomendado)**
1. Instale o app **Traccar Client** (Android/iOS, gratuito)
2. Abra o app → Settings:
   - Device identifier: qualquer número (ex: `123456`)
   - Server URL: `http://SEU_IP_LOCAL:5055`
   - Frequency: 30 segundos
3. Aperte "Start" — o celular vira uma moto no sistema
4. No painel do Traccar (http://localhost:8082), cadastre o device com o mesmo identifier
5. Vincule o `traccarId` do device à moto no banco

**Opção 2 — Painel do Traccar**
- Acesse http://localhost:8082
- Login: admin / admin
- Você pode criar devices e ver as posições chegando

---

## API — todos os endpoints

### Autenticação
```
POST /api/auth/login     → { email, senha } → { token, usuario }
GET  /api/auth/me        → dados do usuário logado
```

### Usuários (Admin)
```
GET    /api/usuarios             → lista todos
GET    /api/usuarios?perfil=MOTOQUEIRO
POST   /api/usuarios             → cria usuário
PUT    /api/usuarios/:id         → atualiza
DELETE /api/usuarios/:id         → desativa
```

### Motos
```
GET /api/motos                   → lista motos
GET /api/motos/posicoes-live     → última posição de todas
GET /api/motos/:id/posicao       → última posição de uma moto
GET /api/motos/:id/trajeto?data=2024-01-15
POST /api/motos                  → cadastra moto (Admin)
PUT  /api/motos/:id              → atualiza moto (Admin)
```

### Locais de entrega
```
GET    /api/locais               → lista locais
POST   /api/locais               → cadastra local
PUT    /api/locais/:id           → atualiza
DELETE /api/locais/:id           → desativa
```

### Entregas
```
GET   /api/entregas              → lista (filtra por data, status, motoqueiro)
GET   /api/entregas/:id          → busca uma entrega
POST  /api/entregas              → cria entrega { notaFiscal, motoqueiroId, motoId, locaisIds[] }
PATCH /api/entregas/:id/iniciar  → moto saiu
PATCH /api/entregas/:id/finalizar → moto voltou
PATCH /api/entregas/parada/:entregaLocalId/confirmar → motoqueiro confirma parada
```

### Relatórios
```
GET /api/relatorios/dashboard?data=2024-01-15
GET /api/relatorios/motoqueiro?motoqueiroId=X&dataInicio=2024-01-01&dataFim=2024-01-31
GET /api/relatorios/km?dataInicio=2024-01-01&dataFim=2024-01-31
```

### Alertas
```
GET   /api/alertas               → lista alertas não lidos
PATCH /api/alertas/:id/ler       → marca como lido
PATCH /api/alertas/ler-todos     → marca todos como lidos
```

### Health check
```
GET /api/health                  → { status: "ok", timestamp }
```

---

## WebSocket — eventos em tempo real

Conecte em: `ws://localhost:3000/ws`

O frontend recebe esses eventos automaticamente:

| Evento              | Quando dispara                          | Dados principais                        |
|---------------------|------------------------------------------|-----------------------------------------|
| `posicao_moto`      | A cada posição GPS recebida             | motoId, lat, lng, velocidade            |
| `nova_entrega`      | Despachante cria entrega                | entrega completa                        |
| `entrega_iniciada`  | Entrega marcada como EM_ROTA            | entregaId, motoId                       |
| `chegada_local`     | GPS detecta moto no local (geofence)    | motoId, local, chegouEm                 |
| `parada_confirmada` | Motoqueiro confirma parada              | entregaLocalId, status                  |
| `entrega_finalizada`| Entrega concluída                       | entrega com kmRealizado                 |
| `novo_alerta`       | Alerta gerado automaticamente           | tipo, descricao                         |

---

## Subir tudo de uma vez (produção local)

```bash
# Na raiz do Projeto_Entrega
docker-compose up -d
```

Isso sobe PostgreSQL + Traccar + Backend juntos.
O frontend ainda precisa rodar separado com `npm run dev` ou fazer o build:

```bash
cd frontend
npm run build
# os arquivos ficam em frontend/dist/
```

---

## Quando chegar o tracker J16

1. Conecte via USB no computador
2. Configure o APN do chip (ex: Vivo = `zap.vivo.com.br`)
3. Configure o servidor: IP da sua VPS ou IP local + porta `5001`
4. Instale na moto (positivo bateria, massa, fio ignição)
5. No painel Traccar, cadastre o device com o IMEI do tracker
6. Atualize o campo `traccarId` da moto no banco:
   ```sql
   UPDATE motos SET "traccarId" = <IMEI_NUMERICO> WHERE placa = 'ABC1D23';
   ```

---

## Custo mensal em produção

| Item                  | Custo       |
|-----------------------|-------------|
| VPS (ou servidor local)| R$0–30/mês |
| Chip M2M por moto     | ~R$20/mês   |
| Domínio (opcional)    | ~R$5/mês    |
| **2 motos total**     | **~R$45–75/mês** |

---

## Stack

| Camada      | Tecnologia                          |
|-------------|-------------------------------------|
| Backend     | Node.js + Express                   |
| Banco       | PostgreSQL + Prisma ORM             |
| GPS         | Traccar (open source)               |
| Roteamento  | OSRM (gratuito, sem chave de API)   |
| Tempo real  | WebSocket nativo (ws)               |
| Frontend    | React + Vite + Tailwind + Leaflet   |
| Infra       | Docker Compose                      |
