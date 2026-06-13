# Dashboard Redesign Plan

## Masalah dengan Dashboard Saat Ini

Dashboard saat ini terlalu sederhana dan kurang informatif:
1. **Hanya 4 stat cards** (Accounts, Requests, Success Rate, Total Tokens) — tanpa konteks perubahan
2. **Token Usage chart** mengambil sebagian besar halaman — terlalu dominan
3. **Tidak ada info provider** — ProviderCards.tsx sudah ada tapi TIDAK digunakan di Dashboard
4. **Tidak ada recent activity** — user harus pindah ke halaman Requests
5. **Tidak ada info credits/quota** — padahal ini data penting
6. **Tidak ada indikator performa** — avg response time tersedia tapi tidak ditampilkan

## Desain Baru yang Diusulkan

### Layout Baru (Top → Bottom):

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard                                          [Period: 1d ▾]  │
│  Overview of your proxy pool status                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Active   │ │ Total    │ │ Success  │ │ Avg      │ │ Credits  │ │
│  │ Accounts │ │ Requests │ │ Rate     │ │ Latency  │ │ Used     │ │
│  │ 5/10     │ │ 1,234    │ │ 98.5%    │ │ 1.2s     │ │ 45.2     │ │
│  │ ↑2 today │ │ +89 24h  │ │ ●●●●○    │ │ ↓0.3s    │ │ of 100   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────┐│
│  │ Token Usage Over Time               │ │ Provider Status         ││
│  │ [Area Chart - lebih compact]        │ │ ┌─ Kiro ──────────────┐ ││
│  │                                     │ │ │ ● 3/5 active        │ ││
│  │                                     │ │ │ ████████░░ 80%      │ ││
│  │                                     │ │ └─────────────────────┘ ││
│  │                                     │ │ ┌─ CodeBuddy ─────────┐ ││
│  │                                     │ │ │ ● 2/3 active        │ ││
│  │                                     │ │ │ ██████░░░░ 60%      │ ││
│  │                                     │ │ └─────────────────────┘ ││
│  │                                     │ │ ┌─ Codex ─────────────┐ ││
│  │                                     │ │ │ ● 1/2 active        │ ││
│  │                                     │ │ │ ████░░░░░░ 40%      │ ││
│  └─────────────────────────────────────┘ └─────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────┐│
│  │ Recent Requests                     │ │ Model Breakdown         ││
│  │ ┌─────────────────────────────────┐ │ │                         ││
│  │ │ ● claude-sonnet  200  1.2s  12K │ │ │ claude-sonnet-4  45%   ││
│  │ │ ● gpt-4o         200  0.8s  8K  │ │ │ ████████████████░░░░   ││
│  │ │ ● claude-opus    200  2.1s  25K │ │ │                         ││
│  │ │ ● claude-sonnet  429  -     -   │ │ │ gpt-4o           30%   ││
│  │ │ ● gpt-4o         200  1.1s  10K │ │ │ ████████████░░░░░░░░   ││
│  │ └─────────────────────────────────┘ │ │                         ││
│  │ View all requests →                 │ │ claude-opus-4    25%   ││
│  └─────────────────────────────────────┘ │ ██████████░░░░░░░░░░   ││
│                                          └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Komponen yang Akan Dibuat/Dimodifikasi

### 1. `Dashboard.tsx` — Halaman utama (REWRITE)
- Tambah period selector global (1d, 7d, 30d, All) di header
- Fetch data providers, recent requests, dan stats sekaligus
- Layout grid 2 kolom untuk section bawah

### 2. `StatsCards.tsx` — REDESIGN (5 cards)
- **Active Accounts** — active/total + badge status
- **Total Requests** — count + delta dari period sebelumnya
- **Success Rate** — percentage + visual dots indicator
- **Avg Latency** — response time + trend arrow
- **Credits Used** — total credits + remaining bar

### 3. `ProviderStatus.tsx` — BARU
- Compact provider cards dengan:
  - Status indicator (dot warna)
  - Active/total accounts
  - Quota progress bar
  - Quick health status

### 4. `RecentRequests.tsx` — BARU
- 5 request terakhir dalam format compact
- Status badge (200=green, 4xx=yellow, 5xx=red)
- Model name, duration, token count
- Link "View all requests →"

### 5. `TokenUsage.tsx` — SIMPLIFY
- Hapus summary cards (sudah ada di StatsCards)
- Chart saja, lebih compact (height 220px instead of 300px)
- Period controlled dari parent (Dashboard)

### 6. `ModelBreakdown.tsx` — EXTRACT dari TokenUsage
- Standalone component
- Progress bars dengan warna per model
- Percentage + token count
- Compact layout

## File yang Akan Diubah

| File | Aksi |
|------|------|
| `dashboard/src/pages/Dashboard.tsx` | Rewrite |
| `dashboard/src/components/dashboard/StatsCards.tsx` | Redesign |
| `dashboard/src/components/dashboard/TokenUsage.tsx` | Simplify |
| `dashboard/src/components/dashboard/UsageChart.tsx` | Minor tweak (height) |
| `dashboard/src/components/dashboard/ProviderStatus.tsx` | **NEW** |
| `dashboard/src/components/dashboard/RecentRequests.tsx` | **NEW** |
| `dashboard/src/components/dashboard/ModelBreakdown.tsx` | **NEW** |
| `dashboard/src/lib/api.ts` | Tambah `fetchRecentRequests()` |

## Data yang Dibutuhkan (Sudah Tersedia di Backend)

- ✅ `GET /api/stats` — pool stats, request counts, tokens, avg duration
- ✅ `GET /api/stats/providers` — per-provider accounts, quota, usage
- ✅ `GET /api/stats/usage` — time-series usage data
- ✅ `GET /api/stats/requests` — recent request logs
- ✅ `GET /api/stats/models` — per-model breakdown

**Tidak perlu modifikasi backend** — semua data sudah tersedia.

## Prinsip Desain

1. **Information density** — Lebih banyak info tanpa overwhelming
2. **Glanceable** — Status penting terlihat dalam 2 detik
3. **Consistent** — Menggunakan design tokens yang sudah ada
4. **Responsive** — Grid collapse di mobile
5. **Real-time** — WebSocket updates tetap berjalan
6. **Performance** — Lazy load data, debounced updates
