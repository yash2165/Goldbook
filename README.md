# GoldBook — Premium MT5 Trading Journal & Discipline Console

GoldBook is a private, high-fidelity analytics dashboard and automated journal engineered specifically for retail and prop-firm gold traders. It replaces manual trading spreadsheets with real-time MetaTrader 5 parallel synchronization, rule compliance telemetry, and statistical performance mapping.

## Key Features

- **Automated MT5 Synchronization**: Native, low-overhead sync scripts that export account balance history, closed deals, and open floating positions in real-time.
- **Discipline & Rules Enforcement**: Self-imposed risk thresholds (e.g. daily loss limits, maximum trades) calculated in real-time with automated compliance logging.
- **Economic News Calendar**: High-impact weekday-aligned economic catalyst forecasts (USD, EUR, GBP, JPY) with explicit timezone dates and times.
- **Interactive Trade Replay Simulator**: Dynamic candle-by-candle chart progression reconstructions for closed trades to analyze emotional states, entry/exit efficiency, and R:R ratios.
- **Anonymized Global Standings**: Secure community leaderboards that compute global PnL, Win Rates, and Most Traded Instruments without exposing private credentials.

## Technology Stack

- **Core**: Next.js (App Router), React 19, TypeScript
- **Styling**: Vanilla CSS with curated custom color palettes, sleek dark modes, and dynamic micro-animations
- **Database & Authentication**: Supabase with custom Gmail OTP verification
- **Hosting & Infrastructure**: Vercel serverless platform and Supabase Secure Cloud Storage for avatar/TradingView clip media uploads

## Local Development Setup

### Prerequisites

- Node.js (version 20 or higher)
- A Supabase project instance with active profiles, mt5_accounts, and trades tables

### 1. Environment Configuration

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
EMAIL_USER=your-verified-gmail@gmail.com
EMAIL_APP_PASS=your-gmail-app-password
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your local instance.
