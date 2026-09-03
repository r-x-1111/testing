# VeriSend dApp

A secure payment verification dApp on Sui with dual-AI verification using GonkaRouter.

## Features

- **Dual-AI Verification**: Consensus-based verification using MiniMax-M2.7 and Kimi-K2.6 models via GonkaRouter
- **Sui Blockchain Integration**: Uses Sui v2 SDK with gRPC client and Programmable Transaction Blocks (PTB)
- **Natural Language Processing**: Parse payment instructions conversationally
- **Safety Checks**: Multi-layer verification including duplicate detection and policy enforcement
- **Receipt Tracking**: Immutable transaction receipts with Gonka request IDs

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Blockchain**: 
  - Sui v2 SDK (`@mysten/sui@^2.29.0`)
  - gRPC Client for efficient blockchain interaction
  - Enoki for sponsored transactions
- **AI**: GonkaRouter OpenAI-compatible API endpoint
  - Model A: MiniMax-M2.7
  - Model B: Kimi-K2.6
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Lucide React icons

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- GonkaRouter API key (from hackathon)
- Supabase project credentials

### Installation

1. Clone and navigate to the project:
```bash
cd veri-send-dapp
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
```

3. Fill in `.env.local` with your credentials:
```env
VITE_GONKA_API_KEY=your_gonka_api_key_here
VITE_SUI_NETWORK=mainnet
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

Start the dev server:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

### Dual-AI Verification Flow

1. User provides payment instruction in natural language
2. Both MiniMax-M2.7 and Kimi-K2.6 models parse the instruction independently
3. Consensus check compares outputs:
   - If models agree → proceed to verification
   - If mismatch → user clarification requested
4. Each model response captures X-Request-Id for receipt verification

### Sui Transaction Flow

- Builds PTB using `buildVeriSendPTB()`
- Supports `instant` and `safesend` execution methods
- SafeSend adds 10-minute escrow period
- Stores receipt with intent hash, purpose hash, and Gonka request IDs

### Safety Checks

- **Reason Verification**: Validates emergency claims against known patterns
- **Duplicate Detection**: Prevents repeated payments to same recipient
- **Policy Evaluation**: Guardian approval for high-value transfers
- **Semantic Validation**: Confidence scoring from AI models

## API Integration

### GonkaRouter

- Endpoint: `https://api.gonkarouter.io/v1/chat/completions`
- Headers: `X-Gonka-No-Fallback: true` (prevents silent model substitution)
- Receipt verification: `GET /v1/receipts/{x-request-id}`

### Sui gRPC

- Mainnet endpoint: `https://mainnet-grpc.sui.io`
- Uses efficient gRPC streaming for balance checks
- PTB validation and signing before broadcast

## Important Notes

⚠️ **Model IDs**: The model IDs in this setup (MiniMaxAI/MiniMax-M2.7, moonshotai/Kimi-K2.6) are based on current GonkaRouter documentation. When you receive your hackathon API key, **verify the exact model IDs in the Models page** and update them accordingly. The model families should remain MiniMax-M2.7 + Kimi-K2.6.

⚠️ **Sui SDK**: This implementation uses the new Sui v2 gRPC client, not the deprecated JSON-RPC client.

## Transaction Status Lifecycle

```
draft → clarifying → verified → paused → awaiting_approval → 
authorized → escrow → completed/cancelled
```

## Deployment

The built assets are in the `dist/` directory and can be deployed to any static host (Vercel, Netlify, GitHub Pages).

## License

MIT
