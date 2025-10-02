# Release Process

This document is for maintainers and describes the process for releasing a new version of the Barndoor TypeScript SDK.

## Overview

The SDK uses automated publishing via GitHub Actions. When you create a GitHub release, the CI/CD pipeline automatically:
1. Runs the full test suite
2. Builds the package
3. Publishes to npm

## Prerequisites

Before creating a release, ensure you have:

- [ ] Write access to the GitHub repository
- [ ] Permissions to create GitHub releases and merge pull requests
- [ ] All changes merged to the `main` branch
- [ ] All tests passing on `main`

## Release Steps

### 1. Prepare the Release Branch

Create a release branch from `main`:

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create a release branch
git checkout -b release/v0.1.1
```

#### Update Version Number

Update the version in `package.json`:

```bash
# For patch releases (0.1.0 -> 0.1.1)
npm version patch --no-git-tag-version

# For minor releases (0.1.0 -> 0.2.0)
npm version minor --no-git-tag-version

# For major releases (0.1.0 -> 1.0.0)
npm version major --no-git-tag-version
```

**Note:** We use `--no-git-tag-version` to prevent automatic tagging. The tag will be created after the PR is merged.

#### Verify the Build

Run the full build and test suite locally:

```bash
# Clean build
npm run clean
npm install

# Build
npm run build

# Run all checks
npm test
npm run lint
npm run type-check
```

All checks should pass before proceeding.

#### Update Documentation (if needed)

- Update `README.md` if there are API changes
- Update examples if API usage has changed

#### Commit Version Changes

Commit the version bump and any documentation updates:

```bash
git add package.json package-lock.json README.md
git commit -m "chore: bump version to v0.1.1"
```

### 2. Create and Merge Pull Request

#### Push Release Branch

Push the release branch to GitHub:

```bash
git push origin release/v0.1.1
```

#### Open Pull Request

1. Go to: https://github.com/barndoor-ai/barndoor-ts-sdk/pulls
2. Click "New pull request"
3. Set base to `main` and compare to `release/v0.1.1`
4. Title: "Release v0.1.1"
5. Description should include:
   - Summary of changes
   - Release notes
   - Link to any relevant issues
6. Request reviews from team members if required
7. Wait for CI checks to pass
8. Get approval and merge the PR

### 3. Create and Push Release Tag

After the PR is merged, create the release tag:

```bash
# Switch to main and pull the merged changes
git checkout main
git pull origin main

# Create the version tag
git tag v0.1.1

# Push the tag
git push origin v0.1.1
```

### 4. Create GitHub Release

#### Via GitHub Web UI

1. Go to: https://github.com/barndoor-ai/barndoor-ts-sdk/releases/new
2. Click "Choose a tag" and select the version tag you just pushed (e.g., `v0.1.1`)
3. Set the release title to the version number (e.g., `v0.1.1`)
4. Add release notes describing:
   - **New Features**: What's new in this release
   - **Bug Fixes**: What issues were resolved
   - **Breaking Changes**: Any backwards-incompatible changes
   - **Deprecations**: Features being deprecated
   - **Internal Changes**: Refactoring, dependency updates, etc.
5. Check "Set as the latest release"
6. Click "Publish release"

### 5. Monitor the Release

Once you publish the GitHub release:

1. **Check GitHub Actions**: Go to https://github.com/barndoor-ai/barndoor-ts-sdk/actions
   - The CI workflow should trigger automatically
   - Verify the `build` job passes
   - Verify the `publish` job completes successfully

2. **Verify npm Publication**: Check https://www.npmjs.com/package/@barndoor-ai/sdk
   - The new version should appear within a few minutes
   - Verify the package contents look correct

3. **Test Installation**: Install the published package:
   ```bash
   # In a test directory
   npm install @barndoor-ai/sdk@latest
   ```

### 6. Post-Release

#### Clean Up Release Branch

Once the release is successfully published, clean up the release branch:

```bash
# Delete local branch
git branch -d release/v0.1.1

# Delete remote branch (if it wasn't auto-deleted by GitHub)
git push origin --delete release/v0.1.1
```

## Release Checklist

Use this checklist for each release:

- [ ] All changes merged to `main` branch
- [ ] Release branch created from latest `main`
- [ ] Version bumped in `package.json` (using `--no-git-tag-version`)
- [ ] Documentation updated for API changes
- [ ] Local build and tests pass
- [ ] Release PR opened and approved
- [ ] Release PR merged to `main`
- [ ] Release tag created and pushed
- [ ] GitHub release created with release notes
- [ ] CI/CD pipeline completed successfully
- [ ] Package verified on npm
- [ ] Test installation from npm works

## Emergency Rollback

If a critical issue is discovered after release:

1. Publish a new patch version with the fix immediately
2. Deprecate the broken version:
   ```bash
   npm deprecate @barndoor-ai/sdk@0.1.1 "Critical bug - use 0.1.2+"
   ```
3. Notify all users through appropriate channels
4. Consider creating a security advisory if it's a security issue
