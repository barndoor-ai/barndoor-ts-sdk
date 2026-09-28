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

# npm's own wording is "a few minutes", but the dist-tag endpoint has been seen
# lagging past five: the v2.2.0 release published cleanly and this script still
# went red, while a manual curl a couple of minutes later showed latest=2.2.0.
# 40 x 15s gives ten, which covers the observed lag. A genuinely failed publish
# is rare and worth ten minutes of certainty; a false red on a good release
# costs more, because it teaches everyone to ignore the check.
ATTEMPTS="${ATTEMPTS:-40}"
INTERVAL="${INTERVAL:-15}"

# %2F, because the scope separator has to survive as a path segment.
ENCODED="${PKG/\//%2f}"
VERSION_URL="https://registry.npmjs.org/${ENCODED}/${VERSION}"
TAGS_URL="https://registry.npmjs.org/-/package/${ENCODED}/dist-tags"

# Cache-Control: no-cache alone did not get us a fresh dist-tags document --
# that is the header this script already sent while it read a stale tag for the
# whole budget. A unique query string is the part the CDN cannot ignore: it
# changes the cache key, so every attempt is a genuine miss. The registry
# ignores the parameter itself.
bust() { printf '%s%s_=%s-%s' "$1" "$([ "${1#*\?}" = "$1" ] && echo '?' || echo '&')" "$$" "$2"; }

echo "Verifying ${PKG}@${VERSION} is served, and that '${DIST_TAG}' points at it"

for attempt in $(seq 1 "$ATTEMPTS"); do
  # `|| true`: a transient 5xx or DNS blip must not end the loop early. The
  # loop's own exhaustion is the failure signal, not one bad request.
  served="$(curl -fsS -H 'Cache-Control: no-cache' "$(bust "$VERSION_URL" "$attempt")" 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)"
  tagged="$(curl -fsS -H 'Cache-Control: no-cache' "$(bust "$TAGS_URL" "$attempt")" 2>/dev/null \
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

# Which half failed changes what to do, so say so rather than printing both and
# leaving the reader to work it out.
if [ "$served" = "$VERSION" ]; then
  echo "::error::${PKG}@${VERSION} IS served, but '${DIST_TAG}' still points at '${tagged:-<absent>}' after ~$((ATTEMPTS * INTERVAL))s. The upload worked; the tag did not move. Consumers resolve by tag, so re-point it with 'npm dist-tag add ${PKG}@${VERSION} ${DIST_TAG}'."
else
  echo "::error::npm publish reported success, but after ~$((ATTEMPTS * INTERVAL))s the registry does not serve ${PKG}@${VERSION} (version='${served:-<absent>}', ${DIST_TAG}='${tagged:-<absent>}'). Nothing was published."
fi
exit 1
