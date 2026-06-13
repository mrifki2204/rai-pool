<div align="center">

# 🤖 RAI Pool

### *Unified AI Proxy Pool for Multiple Providers*

**Load balancing • Auto-warmup • Credit tracking • Beautiful dashboard**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-1.x-f472b6?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)

<br/>

> Route AI requests through a pool of accounts with automatic failover,
> credit tracking, and a real-time dashboard — all behind an OpenAI-compatible API.

<br/>

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

🔀 **Smart Load Balancing**
Distributes requests across healthy accounts with automatic failover

🔄 **Auto-Warmup**
Periodic health checks keep accounts authenticated and ready

📊 **Credit Tracking**
Real-time quota monitoring with exhaustion detection

🌐 **Proxy Pool**
Optional residential proxy support for geo-restricted providers

</td>
<td width="50%">

🎨 **Beautiful Dashboard**
Modern web UI for monitoring, management, and analytics

⚡ **WebSocket Updates**
Real-time status updates — no page refresh needed

🎯 **Filter Rules**
Custom routing rules for different users and models

📈 **Usage Analytics**
Track requests, tokens, costs, and model usage over time

</td>
</tr>
</table>

### Supported Providers

| Provider | Auth Method | Models |
|:---------|:------------|:-------|
| **Kiro** | Email/Password | Claude Sonnet (free tier) |
| **Kiro Pro** | Refresh Token | Claude Opus (higher limits) |
| **CodeBuddy** | Email/Password | Multiple models (Tencent Cloud) |
| **Codex** | OAuth/Token | OpenAI GPT-4o |
| **Canva** | Email/Password | Flux Pro (image generation) |
| **Qoder** | PAT Token | Claude models (job-based) |

---

## 🚀 Quick Start

### One-Command Install

<table>
<tr>
<td>

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/mrifki2204/rai-pool/main/install.sh | bash
```

</td>
<td>

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/mrifki2204/rai-pool/main/install.ps1 | iex
```

</td>
</tr>
</table>

The installer automatically handles everything:

```
✅ Bun runtime          ✅ Python 3.10+         ✅ Git
✅ Node.js packages     ✅ Python packages       ✅ Playwright + Camoufox
✅ Dashboard build      ✅ Database migrations    ✅ CLI setup
```

### Start & Go

```bash
rai start                    # Start the server
```

Open **http://localhost:2002** → Add your accounts → Done! 🎉

---

## 💻 CLI Reference

```bash
rai start          # Start server in background
rai stop           # Stop server
rai restart        # Restart server
rai status         # Check server status
rai logs           # View server logs (follow mode)
rai logs 50        # View last 50 log lines
rai build          # Rebuild dashboard and restart
rai dev            # Run in development mode (hot reload)
rai migrate        # Run database migrations
```

---

## 🔌 API Usage

RAI Pool exposes an **OpenAI-compatible API** — drop it into any tool that supports custom endpoints.

### Chat Completions

```bash
curl http://localhost:2002/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### List Available Models

```bash
curl http://localhost:2002/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and customize:

```bash
# ── Server ────────────────────────────────
PORT=2002                    # Server port (API + Dashboard)

# ── Security ──────────────────────────────
API_KEY=your-secret-key      # API authentication
ENCRYPTION_KEY=...           # Auto-generated, don't change

# ── Database ──────────────────────────────
DATABASE_PATH=./data/poolprox3.db

# ── Browser Automation ────────────────────
BROWSER_ENGINE=camoufox      # or: chromium

# ── Proxy (optional) ─────────────────────
PROXY_URL=                   # Global proxy for outbound requests
```

<details>
<summary><b>📋 All Environment Variables</b></summary>

| Variable | Default | Description |
|:---------|:--------|:------------|
| `PORT` | `2002` | Server port (API + Dashboard) |
| `API_KEY` | `pool-proxy-secret-key` | API authentication key |
| `ENCRYPTION_KEY` | auto-generated | 32-char hex key for encrypting tokens |
| `DATABASE_PATH` | `./data/poolprox3.db` | SQLite database location |
| `BROWSER_ENGINE` | `camoufox` | Browser for login automation |
| `PROXY_URL` | — | Global proxy for all outbound requests |
| `KIRO_PRO_UPGRADE` | `true` | Enable Kiro Pro features |

</details>

---

## 🏗️ Architecture

```
                    ┌─────────────────────────────────────┐
                    │           RAI Pool Server            │
                    │                                     │
  User Request ───▶ │  API Gateway  ───▶  Load Balancer   │
  (OpenAI format)   │       │                   │         │
                    │       ▼                   ▼         │
                    │  Auth Manager      Provider Pool    │ ───▶ Response
                    │       │           ┌───┬───┬───┐    │     (streaming)
                    │       ▼           │ K │ C │ Q │    │
                    │  Credit Tracker   │ i │ o │ o │    │
                    │       │           │ r │ d │ d │    │
                    │       ▼           │ o │ e │ e │    │
                    │  Dashboard ◀──ws──│   │ x │ r │    │
                    │                   └───┴───┴───┘    │
                    └─────────────────────────────────────┘
```

**Request Flow:**
1. **Receive** — OpenAI-compatible request comes in
2. **Route** — Load balancer picks a healthy account with available credits
3. **Translate** — Transform request to provider-specific format
4. **Stream** — Stream response back in OpenAI format
5. **Track** — Update quota usage and analytics

---

## 📁 Project Structure

```
rai-pool/
├── src/                      # Backend source code
│   ├── api/                  #   API routes (Hono)
│   ├── auth/                 #   Login automation & warmup
│   ├── db/                   #   Database schema & migrations
│   ├── lib/                  #   Shared libraries
│   ├── proxy/                #   Provider implementations
│   ├── services/             #   Background services
│   ├── utils/                #   Utility functions
│   ├── ws/                   #   WebSocket server
│   ├── config.ts             #   Configuration
│   └── index.ts              #   Entry point
├── dashboard/                # React dashboard (Vite + Tailwind)
│   ├── src/
│   │   ├── components/       #   UI components
│   │   ├── pages/            #   Page components
│   │   └── hooks/            #   Custom hooks
│   └── public/               #   Static assets
├── scripts/                  # Operational scripts
│   ├── auth/                 #   Python browser automation
│   ├── production.ts         #   Production server
│   ├── watchdog.ts           #   Auto-restart watchdog
│   └── integrate-clients.ts  #   Client integration CLI
├── test/                     # Tests
├── rai / rai.ps1 / rai.cmd   # CLI (Linux/macOS/Windows)
├── install.sh / install.ps1  # One-command installers
└── package.json
```

---

## 🛠️ Development

```bash
# Clone & install
git clone https://github.com/mrifki2204/rai-pool.git
cd rai-pool && bun install
cd dashboard && bun install && cd ..

# Run in dev mode (backend + dashboard with hot reload)
rai dev
```

### Manual Installation

<details>
<summary><b>Step-by-step guide</b></summary>

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash

# 2. Clone & install deps
git clone https://github.com/mrifki2204/rai-pool.git
cd rai-pool
bun install
cd dashboard && bun install && cd ..

# 3. Python environment
python3 -m venv scripts/auth/.venv
source scripts/auth/.venv/bin/activate
pip install -r scripts/auth/requirements.txt

# 4. Install browsers
python -m playwright install chromium
python -m camoufox fetch

# 5. Configure
cp .env.example .env

# 6. Build & run
cd dashboard && bun run build && cd ..
bun src/db/migrate.ts
rai start
```

</details>

---

## 🔧 Troubleshooting

<details>
<summary><b>Playwright/Camoufox not found</b></summary>

```bash
source scripts/auth/.venv/bin/activate
python -m playwright install chromium
python -m camoufox fetch
```

</details>

<details>
<summary><b>Database migration failed</b></summary>

```bash
rm -rf data/poolprox3.db
bun src/db/migrate.ts
```

</details>

<details>
<summary><b>Port already in use</b></summary>

```bash
# Check what's using the port
lsof -i :2002          # macOS/Linux
netstat -ano | findstr :2002  # Windows

# Change ports in .env
PORT=1940
PORT=2042
```

</details>

<details>
<summary><b>Accounts show "Exhausted"</b></summary>

- Wait for auto-warmup to refresh credits
- Click **Warmup** button manually in the dashboard
- Check provider's quota limits

</details>

---

## 🔄 Updating

```bash
# Re-run the installer (recommended)
curl -fsSL https://raw.githubusercontent.com/mrifki2204/rai-pool/main/install.sh | bash

# Or manually
cd ~/rai-pool && git pull
bun install && cd dashboard && bun install && bun run build && cd ..
rai restart
```

---

<div align="center">

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**[Issues](https://github.com/mrifki2204/rai-pool/issues)** · **[Discussions](https://github.com/mrifki2204/rai-pool/discussions)**

Made with ❤️ for the AI community

</div>
