# Contributing to Homestretch

Thanks for helping hourly workers get paid sooner.

## Getting set up

Follow **Run it locally** in the [README](README.md): a PayPal sandbox app, an OpenAI key, `npm install`, `npm run dev`.

## Before you open a pull request

```bash
npm run lint
npm run typecheck
npm test
```

CI runs the same three checks on every push.

## Ground rules

- **Sandbox only.** Never commit a key, a secret or a real person's data. Configuration lives in `.env.local`, which git ignores.
- **Only a person's click pays.** No agent tool may reach the payout routes, and the server keeps setting every amount and recipient itself.
- **One set of rules.** Dragging, the assistant and the health check all ask `lib/schedule/rules.ts`. A new rule goes there, with a test.
- **New agent tools** go in `lib/schedule/agent.ts` as plain functions, and in the allow-list in `lib/assistant.ts`.
- **Small, focused changes** with a clear commit message are easiest to review.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
