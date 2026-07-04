# Distribio

Distribio is a pnpm + Turborepo monorepo.

## Workspace Layout

- `apps/web` - Next.js web application
- `apps/api` - NestJS backend API
- `apps/mobile` - Expo mobile app
- `packages/shared` - shared workspace package

## Getting Started

Enable Corepack if needed, then install dependencies from the repository root:

```bash
corepack enable
pnpm install
```

Run all development apps/services:

```bash
pnpm dev
```

Run a single app:

```bash
pnpm --filter @distribio/web dev
pnpm --filter @distribio/api dev
pnpm --filter @distribio/mobile dev
```

Build apps with build scripts:

```bash
pnpm build
```

## Deployment Notes

For the web app, set the deployment root directory to `apps/web`.

For the backend API on Railway, set the deployment root directory to the
repository root and use:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @distribio/api build
```

Start command:

```bash
pnpm --filter @distribio/api start:prod
```
