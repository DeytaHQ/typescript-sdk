# Contributing to `@deyta-ai/sdk`

Thanks for your interest. This SDK is a thin, typed client over the Deyta
public API — most changes are small, focused, and easy to land.

## Setup

```bash
git clone https://github.com/<org>/<this-repo>.git
cd <this-repo>
bun install
```

Requirements:
- [Bun](https://bun.sh) 1.0+ (recommended) or Node 20+
- TypeScript 5+

## Local commands

```bash
bun run lint        # ESLint
bun run type-check  # tsc --noEmit
bun test            # Bun test, mocked fetch
bun run build       # tsup — emits dual ESM/CJS to dist/
bun run clean       # rm -rf dist
```

All four (`lint`, `type-check`, `test`, `build`) run in CI on every PR.

## Project layout

```
src/
  deyta.ts                 — root client
  client.ts                — HTTP plumbing (retries, signal merge, UA)
  errors.ts                — DeytaError, DeytaConnectionError
  types.ts                 — public input/output types
  user-agent.ts            — User-Agent header builder
  pagination.ts            — async iterator helper
  version.ts               — SDK_VERSION constant (kept in sync with package.json)
  resources/
    memory.ts
    namespaces.ts
    integrations.ts
    namespace-scope.ts     — sub-client returned by namespaces.scope()
__tests__/                 — Bun test, mocked fetch
examples/                  — runnable scripts (not shipped to npm)
docs/                      — Mintlify-import-ready MDX (not shipped to npm)
```

The npm tarball is restricted to `dist/`, `README.md`, `LICENSE`,
`CHANGELOG.md` via the `files` whitelist in `package.json`.

## Adding a new endpoint

1. Add the input/output types to `src/types.ts`.
2. Add the method to the appropriate file under `src/resources/`.
3. If the method belongs to a namespaced surface, also add a thin wrapper to
   `src/resources/namespace-scope.ts`.
4. Re-export new public types from `src/index.ts`.
5. Write a test in `__tests__/<resource>.test.ts` using the `FetchMock`
   helper from `__tests__/_fetch-mock.ts`.
6. Add an entry under `## [Unreleased]` in `CHANGELOG.md`.

## PR checklist

- [ ] `bun run lint` clean
- [ ] `bun run type-check` clean
- [ ] `bun test` — all pass
- [ ] CHANGELOG entry under `## [Unreleased]` (or version-bumped section)
- [ ] No new `any` types in changed files
- [ ] Public API changes are documented in `README.md` and `docs/`

## Code style

- Default to no comments. Add a comment only when the *why* is non-obvious.
- Prefer explicit types on public API surfaces; let inference work inside
  function bodies.
- Snake_case on the wire (matches the API). camelCase only for SDK-only
  concepts (e.g., `RequestOptions` fields).
- Keep `Promise<unknown>` out of public return types — prefer typed shapes.

## Releasing

See [RELEASING.md](./RELEASING.md). Maintainers only.
