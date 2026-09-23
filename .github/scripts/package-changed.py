#!/usr/bin/env python3
"""Decide whether a push can possibly change the published tarball.

Every push to main here is a regeneration from the monorepo, and the prerelease
job publishes on each one. Most pushes do change the package — but a change to
CI, RELEASE.md, examples/ or the spec copy cannot, and publishing anyway burns
an npm version number permanently on a byte-identical package. That happened: a
commit touching only RELEASE.md and ci.yml shipped 2.0.0-dev.g37b8897.

WHAT COUNTS is whatever ends up in the tarball. package.json's `files` is
dist/**, README.md and LICENSE; dist/ is built from src/ under the tsconfigs,
and package.json itself is always included. Everything else in this repo —
.github/, RELEASE.md, examples/, openapi.yaml, test/ — is real content that
belongs here and is read by people, but a consumer running `npm install` never
sees it.

FAILS OPEN. If the push payload is missing, empty or truncated, this says yes.
A version published for nothing is waste; a package change that never publishes
is a customer waiting on a fix that silently did not ship.

Reads the push event payload rather than `git fetch`-ing a base ref: it needs no
history, no credentials, and no third-party action in the repository that
publishes to npm.
"""

import fnmatch
import json
import os
import sys

# Anything whose contents reach `npm pack`, plus the inputs dist/ is built from.
TARBALL_PATHS = [
    "src/**",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.esm.json",
    ".npmignore",
    "README.md",
    "LICENSE",
]


def affects_tarball(path: str) -> bool:
    return any(
        fnmatch.fnmatch(path, pat) or (pat.endswith("/**") and path.startswith(pat[:-2]))
        for pat in TARBALL_PATHS
    )


def main() -> int:
    raw = os.environ.get("COMMITS", "")
    try:
        commits = json.loads(raw) if raw else []
    except json.JSONDecodeError:
        commits = None

    if not commits:
        print("no usable push payload — assuming the package changed", file=sys.stderr)
        print("changed=true")
        return 0

    files = set()
    for commit in commits:
        for key in ("added", "modified", "removed"):
            files.update(commit.get(key) or [])

    hits = sorted(f for f in files if affects_tarball(f))
    for f in sorted(files):
        print(f"  {'PACKAGE' if f in hits else '       '}  {f}", file=sys.stderr)

    print(f"changed={'true' if hits else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
