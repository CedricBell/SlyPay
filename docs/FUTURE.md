# Future extensions

## Real-time transaction detection

- **Plaid / Finicity / MX**: ingest authorized/settled transactions, auto-suggest retroactive “you should have used …” insights.
- **Webhooks + worker queue** (SQS / BullMQ): isolate provider spikes from the API tier.

## Machine learning

- **Merchant → category**: learn from user corrections when MCC and ground truth disagree.
- **Personalized valuations**: map points to cents-per-point per program and travel dates; replace flat comparators with user-specific utility functions.
- **Fraud / anomaly**: unusual spend velocity per wallet (secondary product surface).

## Browser extension

- Inject a lightweight panel on checkout pages; call the same `/recommendation` endpoint with DOM-extracted merchant strings.

## Mobile app

- React Native or Swift/Kotlin client; reuse REST. Consider a compact **GraphQL BFF** only if bandwidth/shape becomes painful.

## Compliance & data

- Official issuer terms change frequently — introduce **versioned rule packs**, effective-dated rows, and audit trails for edits.
- Separate **PII** from **reward math** if expanding to regulated jurisdictions.
