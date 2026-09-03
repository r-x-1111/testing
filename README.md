# VeriSend dApp

A secure payment verification dApp on Sui with dual-AI verification using GonkaRouter, enhanced with VeriPlan predictive budgeting.

## Features

- **Dual-AI Verification**: Consensus-based verification using MiniMax-M2.7 and Kimi-K2.6 models via GonkaRouter
- **VeriPlan Budget Planner**: Natural language financial planning with affordability checks
- **Sui Blockchain Integration**: Uses Sui v2 SDK with gRPC client and Programmable Transaction Blocks (PTB)
- **Natural Language Processing**: Parse payment instructions and budget plans conversationally
- **Safety Checks**: Multi-layer verification including duplicate detection and policy enforcement
- **Receipt Tracking**: Immutable transaction receipts with Gonka request IDs
- **Predictive Safety**: Budget-aware payment warnings and recommendations

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Blockchain**: 
  - Sui v2 SDK (`@mysten/sui@^2.29.0`)
  - gRPC Client for efficient blockchain interaction
  - Enoki for sponsored transactions
- **AI**: 
  - GonkaRouter OpenAI-compatible API endpoint
    - Model A: MiniMax-M2.7 (payment parsing)
    - Model B: Kimi-K2.6 (consensus verification)
  - Natural language budget planning (Gonka MiniMax)
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Lucide React icons

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- GonkaRouter API key (from hackathon)
- Supabase project credentials

### Installation

1. Clone and navigate to the project:
```bash
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

### Seed Example Data (Optional)

To populate the app with example recipients, guardians, and a sample VeriPlan:

1. Open browser console
2. Run:
```javascript
import { seedExampleData } from '@/lib/seedData';
await seedExampleData();
```

Or call from within your app after mounting:
```typescript
import { seedExampleData } from '@/lib/seedData';
useEffect(() => {
  seedExampleData();
}, []);
```

### Production Build

```bash
npm run build
npm run preview
```

## Key Features

### VeriPlan — Predictive AI Budget Planner

VeriPlan helps users create a transparent budget and make affordability-aware payment decisions:

- **Natural Language Budget**: "I earn 3000 USDC. I need 1200 for expenses, want 500 as emergency savings, and I support my parents every month."
- **Smart Analysis**: Deterministic arithmetic showing available transfer capacity
- **Purpose-Based Planning**: Track family support, education, rent, emergency, and custom remittances
- **Affordability Checks**: Real-time warnings when transfers exceed budget capacity or threaten emergency savings
- **6-Month Forecasting**: See projected cash flow and available transfer amounts
- **Payment Integration**: Affordability context flows into SendFlow safety layer

See [VERIPLAN.md](./VERIPLAN.md) for detailed documentation.

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
- SafeSend adds 10-minute escrow period with recovery window
- Stores receipt with intent hash, purpose hash, and Gonka request IDs

### Safety Checks

- **Reason Verification**: Validates emergency claims against known patterns
- **Duplicate Detection**: Prevents repeated payments to same recipient
- **Budget Affordability**: VeriPlan-aware transfer capacity checks
- **Policy Evaluation**: Guardian approval for high-value transfers
- **Semantic Validation**: Confidence scoring from AI models

## Application Flow

### Dashboard
- View wallet balance and recent activity
- Quick send buttons for trusted recipients
- Transaction history at a glance
- VeriPlan budget overview

### VeriPlan Page
- Create/edit financial plan with voice or text
- View income, expenses, and available transfer capacity
- Manage remittance purposes by category
- See 6-month financial forecast
- Get affordability recommendations

### Send Money (SendFlow)
1. **Instruction**: Describe payment naturally
2. **Dual-AI Verify**: Two models agree on interpretation
3. **Reason Check**: Validate factual claims
4. **Safety Layer**: Check patterns and budget affordability
5. **Recipient Check**: Verify trusted status
6. **Intent Lock**: Create tamper-proof verification
7. **Duplicate Shield**: Prevent accidental repeats
8. **Approval**: Guardian authorization if needed
9. **Execution**: Choose instant or SafeSend
10. **Authorization**: Final user confirmation
11. **Receipt**: Auditable on-chain record

### Recipients
- Manage trusted payment recipients
- Confirm wallet addresses
- Set typical amounts and tokens
- Mark as trusted/untrusted

### History
- View all completed transactions
- See full receipts with verification details
- Filter by status, recipient, or amount
- Review safety warnings for each payment

### Settings
- Manage guardians (approvers for high-value payments)
- Define payment policies and thresholds
- Change language and preferences

## API Integration

### GonkaRouter

- Endpoint: `https://api.gonkarouter.io/v1/chat/completions`
- Models: MiniMax-M2.7 (parsing), Kimi-K2.6 (verification)
- Headers: `X-Gonka-No-Fallback: true` (prevents silent model substitution)
- Receipt verification: `GET /v1/receipts/{x-request-id}`

### Sui gRPC

- Mainnet endpoint: `https://mainnet-grpc.sui.io`
- Uses efficient gRPC streaming for balance checks
- PTB validation and signing before broadcast

## Important Notes

⚠️ **Model IDs**: The model IDs in this setup (MiniMaxAI/MiniMax-M2.7, moonshotai/Kimi-K2.6) are based on current GonkaRouter documentation. When you receive your hackathon API key, **verify the exact model IDs in the Models page** and update them accordingly. The model families should remain MiniMax-M2.7 + Kimi-K2.6.

⚠️ **Sui SDK**: This implementation uses the new Sui v2 gRPC client, not the deprecated JSON-RPC client.

⚠️ **VeriPlan**: Is a planning and advisory tool only. It does not automatically authorize payments and never moves funds without explicit user confirmation.

## Transaction Status Lifecycle

```
draft → clarifying → verified → paused → awaiting_approval → 
authorized → escrow/completed → cancelled
```

## Database Schema

### Recipients
- nickname, wallet_address, usual_amount
- trusted flag, wallet confirmation status
- language preference

### Guardians
- name, relationship
- Used for second-approval policies

### Payment Policies
- rule_type (amount_threshold, new_recipient, changed_wallet)
- threshold amounts
- guardian assignments
- enabled/disabled flag

### Financial Plans (VeriPlan)
- monthly_income, essential_expenses, emergency_savings_target
- array of BudgetPurpose objects
- language and natural description
- timestamps for tracking changes

### Transactions
- Full send history with all verification details
- Model outputs, reason checks, safety warnings
- Intent/purpose hashes for tamper detection
- Receipt data and Sui digests

## Deployment

The built assets are in the `dist/` directory and can be deployed to any static host (Vercel, Netlify, GitHub Pages).

## License

MIT

---

**VeriSend**: Where AI interprets, code verifies, and you authorize.
