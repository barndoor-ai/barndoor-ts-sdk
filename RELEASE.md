# Release Process

For maintainers. Releasing a new version of `@barndoor-ai/sdk`.

## What changed

**This repository no longer holds the source of the SDK, and `package.json` is
generated.** The client, its hand-written half, the README and the examples are
maintained in Barndoor's platform monorepo and pushed here by CI; this
repository is where the package is built, published and read by customers.

Two consequences for releasing:

- **Do not run `npm version`, and do not edit `package.json` here.** The version
  comes from `sdk/VERSION` in the monorepo. A hand-edit is silently overwritten
  by the next regeneration, and the version you published disappears.
- **There is no release branch.** Every push to `main` here is a regeneration
  from the monorepo, and each one publishes a prerelease. A release is a tag and
  a GitHub Release on `main` as it already stands.

## How versions reach npm

| Channel | Trigger | Version | dist-tag |
|---|---|---|---|
| prerelease | every push to `main` (a regeneration) | `<version>-dev.g<sha>` | `dev` |
| release | a GitHub Release, created by hand | `<version>` | `latest` |

`package.json` always carries the **clean** version. The `-dev.g<sha>` suffix is
applied in the workflow at publish time and never committed, so a release
publishes exactly what is in the tree with no suffix to strip.

Several API changes therefore accumulate on `main`, each installable
immediately as `@barndoor-ai/sdk@dev`, and ship together when you cut a release.

Publishing authenticates via [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
(OIDC). There is no `NPM_TOKEN` and nothing to rotate. The binding is configured
on the npm package's Access page and is scoped to this repository, the
`ci.yml` workflow, and the `release` environment — so renaming that workflow
file breaks publishing until the binding is recreated.

## The version number

Set in `sdk/VERSION` in the monorepo. It is the version of the **API contract**,
so which SDK speaks to which API needs no lookup table, and it is independent of
the Barndoor platform's own release version.

| Part | Driven by |
|---|---|
| MAJOR | a breaking API change — an operation removed, a field made required |
| MINOR | an additive API change — a new operation, a new optional field |
| PATCH | an SDK-only change — a fix in the hand-written half, a dependency bump |

A gate in the monorepo (`make check-api-version`) compares the spec against its
state at the last bump and fails if the declared number is lower than the change
requires. It is advisory in that a human sets the number and may overrule the
tool, but overruling is a waiver with a reason, not silence.

## Releasing

### 1. Make sure `main` here is what you want to ship

```bash
git checkout main && git pull origin main
node -p "require('./package.json').version"
```

That version is what will be published. If it is not the number you want, bump
`sdk/VERSION` in the monorepo, merge, and wait for the regeneration to land here
— it arrives as a `chore: regenerate the SDK at X.Y.Z` commit.

Check the last push published cleanly: the most recent `CI` run on `main` should
be green, including its `Confirm the registry serves it` step.

### 2. Tag it

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 3. Cut the GitHub Release

1. https://github.com/barndoor-ai/barndoor-ts-sdk/releases/new
2. Choose the tag you just pushed, title it `vX.Y.Z`
3. Write the notes — new features, bug fixes, breaking changes, deprecations
4. Check **Set as the latest release**
5. Publish

Publishing the Release is what triggers `ci.yml`'s `publish` job.

### 4. Confirm it

The `publish` job builds, tests, publishes, and then polls the registry until
the version is served **and** `latest` points at it — a green `npm publish` is
not evidence the registry serves anything, so the job proves it rather than
assuming. If that step fails, the publish did not take effect regardless of what
the earlier steps reported.

Then, independently:

```bash
npm view @barndoor-ai/sdk version     # expect X.Y.Z
npm install @barndoor-ai/sdk@latest   # in a scratch directory
```

## Emergency rollback

npm versions cannot be replaced, only superseded.

1. Fix the problem in the **monorepo** — that is where the source lives.
2. Bump `sdk/VERSION` (a PATCH, unless the fix itself changes the API).
3. Merge, let the regeneration land here, then tag and release as above.
4. Deprecate the bad version so installs carry a warning:

   ```bash
   npm deprecate @barndoor-ai/sdk@X.Y.Z "Critical bug — use X.Y.(Z+1) or later"
   ```

If the bad version is on `latest`, moving the tag back is faster than a fix:

```bash
npm dist-tag add @barndoor-ai/sdk@<last-good-version> latest
```

## Contributing changes

Not here. Pull requests against generated files in this repository cannot be
merged — the next regeneration overwrites them. The generator inputs live in the
monorepo under `sdk/typescript/`:

| To change | Edit |
|---|---|
| the API surface | the service that owns the endpoint; the spec is generated from it |
| auth, retries, MCP, the CLI | `sdk/typescript/src/lib/` |
| the published README or examples | `sdk/typescript/README.md`, `sdk/typescript/examples/` |
| the version | `sdk/VERSION` |
| generation itself | `sdk/typescript/gen-config.yaml`, `sdk/typescript/templates/` |

Files this repository **does** own, and which no regeneration touches:
`.github/` (including `ci.yml` and the publish scripts), `LICENSE`, and this
document.
