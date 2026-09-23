#!/usr/bin/env bash
#
# Confirm the registry actually SERVES a version we just published, and that the
# dist-tag moved to it.
#
# WHY THIS EXISTS. `npm publish` returns success and then processes the upload
# asynchronously — its own last line is "Your package is being processed and may
# take a few minutes to become available." So a green publish step is not
# evidence that anything was published. During this pipeline's rollout a publish
# reported success while the registry still served nothing, and the only way to
# tell the difference was reading the job log by hand.
#
# It also catches the case a publish CANNOT: a version that uploads but whose
# dist-tag never moves. Consumers resolve by tag, so `dev` pointing at yesterday
# is the same as not having published.
#
# Queries registry.npmjs.org directly rather than `npm view`:
#   * the version document is authoritative and per-version, so a stale cache of
#     the package's aggregate document cannot mask a missing publish — that
#     aggregate is CDN-cached and lagged behind reality by minutes here
#   * /-/package/<name>/dist-tags is the dedicated tag endpoint, for the same
#     reason
#
# Usage: verify-published.sh <package> <version> <expected-dist-tag>

set -euo pipefail

PKG="${1:?usage: verify-published.sh <package> <version> <dist-tag>}"
VERSION="${2:?usage: verify-published.sh <package> <version> <dist-tag>}"
DIST_TAG="${3:?usage: verify-published.sh <package> <version> <dist-tag>}"

# npm's own wording is "a few minutes"; 20 x 15s gives five, which is generous
# without turning a genuinely failed publish into a five-minute-plus red build.
ATTEMPTS="${ATTEMPTS:-20}"
INTERVAL="${INTERVAL:-15}"

# %2F, because the scope separator has to survive as a path segment.
ENCODED="${PKG/\//%2f}"
VERSION_URL="https://registry.npmjs.org/${ENCODED}/${VERSION}"
TAGS_URL="https://registry.npmjs.org/-/package/${ENCODED}/dist-tags"

echo "Verifying ${PKG}@${VERSION} is served, and that '${DIST_TAG}' points at it"

for attempt in $(seq 1 "$ATTEMPTS"); do
  # `|| true`: a transient 5xx or DNS blip must not end the loop early. The
  # loop's own exhaustion is the failure signal, not one bad request.
  served="$(curl -fsS -H 'Cache-Control: no-cache' "$VERSION_URL" 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)"
  tagged="$(curl -fsS -H 'Cache-Control: no-cache' "$TAGS_URL" 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('${DIST_TAG}',''))" 2>/dev/null || true)"

  if [ "$served" = "$VERSION" ] && [ "$tagged" = "$VERSION" ]; then
    echo "attempt ${attempt}: served, and ${DIST_TAG} -> ${VERSION}"
    {
      echo "### Published \`${PKG}@${VERSION}\` (\`${DIST_TAG}\`)"
      echo
      echo "Verified against the registry, not just the publish step."
    } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi

  echo "attempt ${attempt}/${ATTEMPTS}: version=${served:-<absent>} ${DIST_TAG}=${tagged:-<absent>}"
  [ "$attempt" -lt "$ATTEMPTS" ] && sleep "$INTERVAL"
done

echo "::error::npm publish reported success, but after ~$((ATTEMPTS * INTERVAL))s the registry serves version='${served:-<absent>}' and ${DIST_TAG}='${tagged:-<absent>}' (expected ${VERSION})."
exit 1
