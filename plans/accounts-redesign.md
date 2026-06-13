# Accounts Pages Redesign Plan

## Masalah Saat Ini

### Accounts.tsx (Overview)
1. Provider cards terlalu besar dan repetitif — 3 kolom tapi banyak ruang kosong
2. Status grid (Active/Exhausted/Pending/Error) kurang visual
3. BYOK section terpisah jauh dari provider cards
4. Tidak ada summary/overview di atas
5. Auto WarmUp toggle + countdown bisa lebih compact
6. Buttons (Add/Warmup/Retry) bisa lebih intuitif

### AccountList.tsx (Detail)
1. Tabel terlalu plain — tidak ada summary stats di atas
2. Tidak ada visual indicator untuk health keseluruhan
3. Actions buttons terlalu kecil dan sulit dibedakan
4. Credit info bisa lebih visual (progress bar)
5. Tidak ada quick-action untuk bulk operations yang lebih jelas

---

## Redesign: Accounts.tsx (Overview)

### Layout Baru:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Accounts                                    [Refresh] [Login All]  │
│  Manage provider accounts                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── Summary Bar ──────────────────────────────────────────────┐   │
│  │ 🟢 12 Active  🟡 3 Exhausted  🔴 2 Error  ⏳ 1 Pending      │   │
│  │ Total: 18 accounts across 6 providers                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Provider Cards (2x3 grid, more compact) ──────────────────┐  │
│  │ ┌─────────────────────┐ ┌─────────────────────┐              │  │
│  │ │ Kiro                │ │ Kiro Pro             │              │  │
│  │ │ ●●●○○ 3/5 active    │ │ ●● 2/2 active       │              │  │
│  │ │ ████████░░ 80% quota │ │ ██████████ 100%     │              │  │
│  │ │ 🔥 Auto: 12:34      │ │ 🔥 Auto: 12:34      │              │  │
│  │ │ [Add] [Warmup] [→]  │ │ [Add] [Warmup] [→]  │              │  │
│  │ └─────────────────────┘ └─────────────────────┘              │  │
│  │ ┌─────────────────────┐ ┌─────────────────────┐              │  │
│  │ │ CodeBuddy           │ │ Canva                │              │  │
│  │ │ ...                 │ │ ...                  │              │  │
│  │ └─────────────────────┘ └─────────────────────┘              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── BYOK Section (integrated, same card style) ───────────────┐  │
│  │ Custom Providers (BYOK)                    [+ Add Provider]   │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │  │
│  │ │ OpenRouter│ │ Together │ │ Groq     │                       │  │
│  │ │ ● Active  │ │ ● Active │ │ ○ Error  │                       │  │
│  │ │ 5 models  │ │ 3 models │ │ 2 models │                       │  │
│  │ └──────────┘ └──────────┘ └──────────┘                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Perubahan Utama:
1. **Summary Bar** di atas — total accounts, status breakdown
2. **Provider Cards lebih compact** — dot indicators untuk status, inline quota bar
3. **Auto WarmUp** lebih compact — single line dengan countdown
4. **Navigate arrow** — klik card untuk ke detail
5. **BYOK cards** — same visual style, lebih compact

---

## Redesign: AccountList.tsx (Detail)

### Layout Baru:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Kiro                                                             │
│  5 accounts                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── Stats Row ────────────────────────────────────────────────┐   │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐  │   │
│  │ │ Active │ │ Exh.   │ │ Error  │ │ Pending│ │ Total Quota│  │   │
│  │ │   3    │ │   1    │ │   1    │ │   0    │ │ 45.2/100   │  │   │
│  │ └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Toolbar ──────────────────────────────────────────────────┐   │
│  │ [🔍 Search...        ] [All|Active|Exh|Error|Pending]        │   │
│  │ [Warmup All] [Retry Errors] [Enable All] [Disable All]       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Account Table (improved) ─────────────────────────────────┐   │
│  │ Email          Status  Enabled  Credit        Last Login  Act │   │
│  │ ─────────────────────────────────────────────────────────────│   │
│  │ user@mail.com  ● Active  [ON]   ████░ 8.2/10  2h ago     ⋮  │   │
│  │ test@mail.com  ● Exh.    [ON]   ░░░░░ 0/10    5h ago     ⋮  │   │
│  │ bad@mail.com   ● Error   [OFF]  —             1d ago      ⋮  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Perubahan Utama:
1. **Stats Row** di atas — quick glance status counts + total quota
2. **Credit column** — visual progress bar inline di tabel
3. **Last Login** — relative time (2h ago) instead of full datetime
4. **Actions** — dropdown menu instead of multiple icon buttons
5. **Status** — colored dot + text instead of badge (more compact)
6. **Better mobile** — responsive card view on small screens

---

## File yang Akan Diubah

| File | Aksi |
|------|------|
| `dashboard/src/pages/Accounts.tsx` | Redesign — summary bar, compact cards |
| `dashboard/src/pages/AccountList.tsx` | Redesign — stats row, better table |

## Prinsip:
- Tidak mengubah fungsionalitas (semua handler tetap sama)
- Hanya mengubah presentasi/layout
- Tetap responsive
- Menggunakan komponen UI yang sudah ada
