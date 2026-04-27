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

The release workflow currently uses an `NPM_TOKEN` secret. To set it up:

1. Create an automation token at https://www.npmjs.com/settings/<your-user>/tokens
   with type **Granular** and **Read and publish** access scoped to
   `@deyta-ai/sdk`.
2. Add it as `NPM_TOKEN` in this repo's GitHub Actions secrets.

### Upgrading to Trusted Publishers (OIDC, recommended)

Once you're comfortable, switch to OIDC-based publishing — no secret
required, signed provenance proves the tarball came from this exact
workflow run:

1. Go to https://www.npmjs.com/package/@deyta-ai/sdk/access
2. Click **Trusted Publishers** → **Add publisher**
3. Choose **GitHub Actions**, fill in:
   - Organization: `<your-gh-org>`
   - Repository: `<this-repo-name>`
   - Workflow filename: `release.yml`
   - Environment: leave blank (or set if you use environments)
4. In `release.yml`, remove the `NODE_AUTH_TOKEN` env line. Keep
   `permissions.id-token: write` and the `setup-node` step with
   `registry-url`. That's it.

After that, you can also revoke the `NPM_TOKEN` secret.
