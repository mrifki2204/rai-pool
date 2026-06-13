# Accounts Icons & Buttons Improvement

## Approach
Buat custom SVG icon components untuk tiap provider yang terinspirasi dari brand mereka:
- **Kiro** — AWS-style arrow/swoosh (orange gradient)
- **Kiro Pro** — Same but with "Pro" star badge
- **CodeBuddy** — Tencent-style penguin/code bracket
- **Canva** — Gradient circle (Canva brand)
- **Codex** — OpenAI-style hexagon/spiral
- **Qoder** — Code terminal style
- **BYOK** — Key with custom badge

## Buttons
- Gradient backgrounds instead of flat
- Subtle hover animations (scale + glow)
- Icon + text with better spacing
- Rounded pill shape for primary actions

## Files
- `dashboard/src/components/dashboard/ProviderIcon.tsx` — NEW: SVG icons per provider
- `dashboard/src/pages/Accounts.tsx` — Update to use new icons + better buttons
