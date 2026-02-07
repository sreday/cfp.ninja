# Stripe Payment Setup

CFP.ninja supports two optional payment flows via Stripe:
1. **Event listing fee** - organizers pay to publish/open their CFP
2. **CFP submission fee** - a fixed per-submission fee to prevent spam/bot submissions

## Development (Test Mode)

1. Create a Stripe account at https://dashboard.stripe.com
2. Switch to **Test mode** (toggle in the top-right of dashboard)
3. Go to **Developers > API keys**
4. Copy the **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)
5. Set environment variables:
   ```bash
   export STRIPE_PUBLISHABLE_KEY=pk_test_...
   export STRIPE_SECRET_KEY=sk_test_...
   export EVENT_LISTING_FEE=2500              # $25.00 in cents
   export EVENT_LISTING_FEE_CURRENCY=usd
   export SUBMISSION_LISTING_FEE=100          # $1.00 in cents (default)
   export SUBMISSION_LISTING_FEE_CURRENCY=usd # default
   ```

## Local Webhook Testing

1. Install the Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:8080/api/v0/webhooks/stripe
   ```
4. Copy the webhook signing secret (`whsec_...`) from the CLI output:
   ```bash
   export STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Production

1. Complete Stripe account verification (identity, bank details)
2. Switch to **Live mode** in the Stripe Dashboard
3. Go to **Developers > API keys** and copy the live keys (`pk_live_...`, `sk_live_...`)
4. Go to **Developers > Webhooks** and create an endpoint:
   - **URL**: `https://your-domain.com/api/v0/webhooks/stripe`
   - **Events to listen for**: `checkout.session.completed`
5. Copy the webhook signing secret to your production environment
6. Ensure HTTPS is configured (Stripe requires it for production webhooks)

## Test Cards

- **Success**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`
- Any future expiry date, any 3-digit CVC

## Configuration Reference

| Variable | Description | Default |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key | (required for payments) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | (required for payments) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | (required for webhooks) |
| `EVENT_LISTING_FEE` | Event listing fee in cents | `0` (free) |
| `EVENT_LISTING_FEE_CURRENCY` | Currency for listing fee | `usd` |
| `SUBMISSION_LISTING_FEE` | Per-submission fee in cents | `100` ($1.00) |
| `SUBMISSION_LISTING_FEE_CURRENCY` | Currency for submission fee | `usd` |

## How It Works

### Event Listing Fee
- Events are created as drafts for free
- If `EVENT_LISTING_FEE > 0`, the organizer must pay before the CFP can be opened
- Payment is handled via Stripe Checkout (redirect flow)
- The webhook marks the event as paid after successful payment

### Submission Fee
- Organizers can toggle "Require payment for submissions" on their event
- The fee amount is fixed server-wide (`SUBMISSION_LISTING_FEE`) and not customizable per event
- Proposals are created normally; payment happens via a separate checkout flow
- Speakers can complete payment from their dashboard if they cancel initially
