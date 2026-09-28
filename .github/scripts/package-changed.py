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

THE DIFF COMES FROM GIT, not from the push event. This used to read
`github.event.commits[].added/modified/removed`, which GitHub OMITS on a commit
touching many files — and a regeneration touches every generated model, 282 of
them on 0f875595d. The keys were absent rather than empty, so this reported
"unchanged" about a push that rewrote the entire client, and every regeneration
since silently skipped its prerelease. The payload's file lists are best-effort
with undocumented caps; `git diff` has neither property.

FAILS OPEN. If the base commit is missing, unreachable or unreadable, this says
yes. A version published for nothing is waste; a package change that never
publishes is a customer waiting on a fix that silently did not ship.
"""

import fnmatch
import os
import subprocess
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

# What GitHub sends as `before` for the first push to a ref.
EMPTY_SHA = "0" * 40


def affects_tarball(path: str) -> bool:
    return any(
        fnmatch.fnmatch(path, pat) or (pat.endswith("/**") and path.startswith(pat[:-2]))
        for pat in TARBALL_PATHS
    )


def open_because(reason: str) -> int:
    print(f"{reason} — assuming the package changed", file=sys.stderr)
    print("changed=true")
    return 0


def changed_files(base: str, head: str) -> list[str] | None:
    """Paths differing between two commits, or None if git cannot tell us."""
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{base}..{head}"],
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, OSError) as exc:
        print(f"git diff failed: {exc}", file=sys.stderr)
        return None
    return [line for line in out.stdout.splitlines() if line]


def main() -> int:
    base = os.environ.get("BEFORE", "").strip()
    head = os.environ.get("SHA", "").strip()

    if not head:
        return open_because("no head sha")
    if not base or base == EMPTY_SHA:
        return open_because("no base commit (first push to this ref)")

    # A force push can leave `before` unreachable, and a shallow clone will not
    # have it either. Either way we cannot diff, so we publish.
    if subprocess.run(["git", "cat-file", "-e", f"{base}^{{commit}}"]).returncode != 0:
        return open_because(f"base commit {base[:9]} is not in this clone")

    files = changed_files(base, head)
    if files is None:
        return open_because("git could not produce a diff")
    if not files:
        print(f"no files changed between {base[:9]} and {head[:9]}", file=sys.stderr)
        print("changed=false")
        return 0

    hits = sorted(f for f in files if affects_tarball(f))
    for f in sorted(files):
        print(f"  {'PACKAGE' if f in hits else '       '}  {f}", file=sys.stderr)
    print(f"{len(hits)} of {len(files)} changed files reach the tarball", file=sys.stderr)

    print(f"changed={'true' if hits else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
