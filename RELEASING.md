# Releasing `@deyta-ai/sdk`

This SDK uses tag-triggered releases: push a `vX.Y.Z` tag and GitHub Actions
publishes to npm with provenance and creates a GitHub Release.

## Versioning

Semantic versioning (https://semver.org). While we are pre-1.0:

- **`0.x.y` → `0.x.(y+1)`** — bug fixes, internal refactors, doc-only changes.
- **`0.x.y` → `0.(x+1).0`** — anything user-visible: new APIs, breaking changes,
  type signature changes. We use minor bumps for breaking changes pre-1.0
  because callers should expect them at this stage.
- **`0.x.y` → `1.0.0`** — when the API is considered stable. Plan a deliberate
  audit of every public symbol before flipping.

Once we reach `1.0.0`, normal semver applies: bug → patch, additive → minor,
breaking → major.

## Steps to ship a release

### 1. Bump the version

There are **three** places to update the version. The CI verifies they match.

```bash
# 1. package.json
npm version 0.3.0 --no-git-tag-version

# 2. src/version.ts
sed -i '' 's/SDK_VERSION = ".*"/SDK_VERSION = "0.3.0"/' src/version.ts

# 3. CHANGELOG.md — add a "## [0.3.0]" section above the previous entry
```

The `package.json` and `src/version.ts` versions must match exactly — a CI
check fails the build otherwise. The CHANGELOG must contain a `## [0.3.0]`
heading or the release workflow refuses to publish.

### 2. Write the CHANGELOG entry

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:

```markdown
## [0.3.0]

### Added
- New feature X.

### Changed
- **Breaking** Renamed `foo` to `bar`.

### Fixed
- Bug Y.
```

Mark every breaking change with `**Breaking**` so consumers can scan for them.

### 3. Open a PR

The `version-guard` workflow runs on PRs that touch `src/` or `package.json`
and refuses to merge changes without either a version bump or a CHANGELOG
entry. CI also runs lint, type-check, tests, build, and a tarball pack
dry-run.

Get the PR reviewed and merged.

### 4. Tag and push

After the PR is merged into `main`:

```bash
git checkout main
git pull origin main

# Tag the merge commit
git tag v0.3.0
git push origin v0.3.0
```

The `release.yml` workflow runs on the tag push:

1. Verifies the tag matches `package.json` version
2. Verifies `CHANGELOG.md` has a section for this version
3. Runs the full build pipeline (`clean → lint → type-check → test → build`)
4. Publishes to npm with `--provenance` (signed attestation)
5. Creates a GitHub Release with auto-generated notes

If any step fails, the package is **not** published. Fix the issue, delete
the tag (`git push origin :refs/tags/v0.3.0`), and re-tag the corrected
commit.

### 5. Verify the release

```bash
npm view @deyta-ai/sdk version
# should print: 0.3.0

npm view @deyta-ai/sdk dist.tarball
# the URL of the just-published tarball
```

Note that `bun add @deyta-ai/sdk` may be blocked for ~7 days by the
`minimumReleaseAge` supply-chain protection (npm has a similar setting).
This is expected. Add `@deyta-ai/sdk` to `minimumReleaseAgeExcludes` in your
own `bunfig.toml` if you need to install it immediately for testing.

## Pre-release versions

For pilot releases that shouldn't be picked up by `npm install` defaults,
publish under a `next` tag:

```bash
# In package.json:
"version": "0.3.0-rc.1"

git tag v0.3.0-rc.1
git push origin v0.3.0-rc.1
```

The release workflow auto-detects pre-release versions and publishes them
under the `next` dist-tag instead of `latest`. Consumers opt in with
`npm install @deyta-ai/sdk@next`.

> Note: this behavior requires a small change in `release.yml`. If you need
> pre-releases, update the `npm publish` step to:
> `npm publish --provenance --tag $(node -p "require('./package.json').version.includes('-') ? 'next' : 'latest'") --access public`

## Yanking a release

If a release is broken, **don't** unpublish — npm forbids it after 72h, and
even within 72h it breaks downstream lockfiles. Instead:

1. Publish a fix as the next patch version (`0.3.1`).
2. Optionally `npm deprecate @deyta-ai/sdk@0.3.0 "Broken — upgrade to 0.3.1"`.

## NPM authentication

This repo publishes via npm **Trusted Publishers** (OIDC) — no secret is
stored in GitHub Actions. The npm registry trusts the GitHub Actions OIDC
identity for this exact `<org>/<repo>/<workflow-filename>` triple, and
each published tarball carries a signed provenance attestation.

If the trusted publisher is ever revoked or you need to reconfigure:

1. Go to https://www.npmjs.com/package/@deyta-ai/sdk/access
2. **Trusted Publishers** → **Add publisher** → **GitHub Actions**
3. Fill in:
   - Organization: `DeytaHQ`
   - Repository: `typescript-sdk`
   - Workflow filename: `release.yml`
   - Environment: leave blank
4. Save.

The `release.yml` workflow already has the required pieces:

- `permissions: id-token: write` (allows GitHub to mint an OIDC token)
- `actions/setup-node` with `registry-url: "https://registry.npmjs.org"`
  (writes a registry-aware `.npmrc` for `npm publish`)
- `npm publish --provenance --access public` (verifies OIDC, attaches
  provenance attestation, publishes)

No `NPM_TOKEN` secret is needed and none should be added — adding one
would override the OIDC flow and silently fall back to token-based auth.

### Manual publish from a laptop (rare)

If you ever need to publish outside CI (recovery, special circumstance):

```bash
npm login                 # interactive, prompts for 2FA
npm publish --provenance  # only OIDC publishes can attach provenance, so manual publishes are unattested
```

Manual publishes don't get provenance attestations. Prefer fixing CI and
re-tagging over publishing manually.
