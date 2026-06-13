# tlj-blocks

A monorepo of reusable **building blocks** for application development. Each
block is a small, focused component (frontend, infrastructure, or both) that
drops into your own app.

## Blocks

| Block                                     | What it does                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| [`tlj-feedback`](./packages/tlj-feedback) | Collect in-app bug/feature feedback and email it (client + CDK construct). |
| `tlj-error-report`                        | _(placeholder — not yet implemented)_                                      |

## Layout

This is an npm workspace. Blocks live under `packages/`; a block may contain one
or more publishable packages (e.g. `tlj-feedback` ships a `client` and a `cdk`
package).

```
packages/
├── tlj-feedback/
│   ├── client/   → tlj-feedback-client
│   └── cdk/      → tlj-feedback-cdk
└── tlj-error-report/
```

## Development

```sh
npm install      # install + link all workspaces
npm run build    # build every package (TypeScript → dist/)
npm test         # run every package's tests
```

Packages are TypeScript, sharing the compiler options in
[`tsconfig.base.json`](./tsconfig.base.json).
