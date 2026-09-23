#!/usr/bin/env bash
# Query the PYQdeck Discovery Engine app and print the AI overview.
#
#   ./scripts/discovery-search.sh "what is AI"
#   ./scripts/discovery-search.sh "normalization in DBMS" --extractive
#   ./scripts/discovery-search.sh "what is AI" --raw          # full JSON
#   ./scripts/discovery-search.sh "what is AI" --n 10         # more results
#
# Exploration tool only. The app never calls Discovery Engine directly - it
# goes through api.pyqdeck.in, which authenticates with a service account.
# This uses your own gcloud login purely to inspect responses.
set -euo pipefail

PROJECT="124734118875"
ENGINE="pyqdeck_1787542792054"
ENDPOINT="https://discoveryengine.googleapis.com/v1alpha/projects/${PROJECT}/locations/global/collections/default_collection/engines/${ENGINE}/servingConfigs/default_search:search"

QUERY="${1:-}"
if [ -z "$QUERY" ]; then
  echo "usage: $0 \"<query>\" [--extractive] [--raw] [--n <count>]" >&2
  exit 1
fi
shift

MODE="summary"
RAW=0
COUNT=5
while [ $# -gt 0 ]; do
  case "$1" in
    --extractive) MODE="extractive" ;;
    --summary)    MODE="summary" ;;
    --raw)        RAW=1 ;;
    --n)          COUNT="${2:-5}"; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

# winget puts gcloud on the machine PATH, but a shell started before the
# install keeps the old copy - fall back to the known install location.
# -f, not -x: a .cmd has no executable bit under Git Bash.
GCLOUD="$(command -v gcloud || true)"
if [ -z "$GCLOUD" ]; then
  for candidate in \
    "${LOCALAPPDATA:-/c/Users/$USERNAME/AppData/Local}/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd" \
    "/c/Users/$USERNAME/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd" \
    "/c/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd" \
    "/c/Program Files/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
  do
    # LOCALAPPDATA arrives as a Windows path; make it usable here.
    candidate="$(printf '%s' "$candidate" | sed 's#^\([A-Za-z]\):\\#/\L\1/#; s#\\#/#g')"
    if [ -f "$candidate" ]; then GCLOUD="$candidate"; break; fi
  done
fi
if [ -z "$GCLOUD" ] || { [ ! -f "$GCLOUD" ] && ! command -v gcloud >/dev/null 2>&1; }; then
  echo "gcloud not found. Install with: winget install --id Google.CloudSDK -e" >&2
  echo "(already installed? open a new terminal so PATH refreshes)" >&2
  exit 1
fi

TOKEN="$("$GCLOUD" auth print-access-token 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then
  echo "No access token. Run: \"$GCLOUD\" auth login" >&2
  exit 1
fi

if [ "$MODE" = "summary" ]; then
  # ignoreNonSummarySeekingQuery is false here so a lookup-style query still
  # returns something to look at; set it true in production, where declining
  # to summarise "DBMS 2022 paper" is the wanted behaviour.
  CONTENT_SPEC="{\"summarySpec\":{\"summaryResultCount\":${COUNT},\"includeCitations\":true,\"ignoreAdversarialQuery\":true,\"ignoreNonSummarySeekingQuery\":false}}"
else
  CONTENT_SPEC='{"extractiveContentSpec":{"maxExtractiveAnswerCount":1}}'
fi

BODY=$(QUERY="$QUERY" COUNT="$COUNT" CONTENT_SPEC="$CONTENT_SPEC" python -c '
import json, os
print(json.dumps({
  "query": os.environ["QUERY"],
  "pageSize": int(os.environ["COUNT"]),
  "queryExpansionSpec": {"condition": "AUTO"},
  "spellCorrectionSpec": {"mode": "AUTO"},
  "languageCode": "en-GB",
  "contentSearchSpec": json.loads(os.environ["CONTENT_SPEC"]),
  "userInfo": {"timeZone": "Asia/Calcutta"},
}))')

RESPONSE=$(curl -s -m 90 -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "$ENDPOINT" -d "$BODY")

if [ "$RAW" = "1" ]; then
  echo "$RESPONSE" | python -m json.tool
  exit 0
fi

RESPONSE="$RESPONSE" python <<'PY'
import json, os, sys, textwrap

d = json.loads(os.environ["RESPONSE"])
if "error" in d:
    print("API error:", d["error"].get("message", d["error"]), file=sys.stderr)
    sys.exit(1)

print(f"total results: {d.get('totalSize', 0)}\n")

# References carry no uri of their own, but their document id is the same id
# the search results use, and those DO carry the live pyqdeck.in link - so
# join on it to turn a citation into something you can actually open.
links = {}
for r in d.get("results", []):
    doc = r.get("document", {})
    sd = doc.get("derivedStructData", {}) or {}
    if doc.get("id") and sd.get("link"):
        links[doc["id"]] = sd["link"]

meta = (d.get("summary") or {}).get("summaryWithMetadata") or {}
text = meta.get("summary") or (d.get("summary") or {}).get("summaryText")

def annotate(body, citations):
    """Put [n] markers back into the clean summary.

    summaryText already ships with markers, but only as text. The spans in
    citationMetadata are the real data, and they are what the app has to work
    from to make a marker tappable - so build from those and prove the index
    maths here rather than in production.

    Two traps: referenceIndex is 0-based while the prose numbers from 1, and
    it is OMITTED entirely when it is 0, so a bare {} source means [1].

    Offsets are treated as UTF-8 bytes (the protobuf convention). Every
    summary seen so far is pure ASCII, where bytes and characters agree, so
    this is untested against a non-ASCII summary.
    """
    raw = body.encode("utf-8")
    inserts = []
    for c in citations:
        end = int(c.get("endIndex", 0))
        refs = sorted({int(s.get("referenceIndex", 0)) + 1 for s in c.get("sources", [])})
        if refs:
            inserts.append((end, " [" + ", ".join(str(n) for n in refs) + "]"))
    # Apply back to front so earlier offsets stay valid.
    for end, marker in sorted(inserts, reverse=True):
        raw = raw[:end] + marker.encode("utf-8") + raw[end:]
    return raw.decode("utf-8", "replace")


if text:
    print("=== AI OVERVIEW ===")
    cites = (meta.get("citationMetadata") or {}).get("citations", [])
    shown = annotate(text, cites) if cites else text
    for para in shown.split("\n"):
        print(textwrap.fill(para, 88) if para.strip() else "")
    refs = meta.get("references", [])
    if refs:
        print("\n=== SOURCES ===")
        for i, r in enumerate(refs, 1):
            # References carry no uri - only the datastore document name, whose
            # last segment is the doc id. Mapping that back to a PYQdeck
            # question/topic is the server's job.
            doc = (r.get("document") or "").rsplit("/", 1)[-1]
            print(f"  [{i}] {r.get('title', '(untitled)')[:80]}")
            # A reference can cite a document outside the returned page, so
            # keep pageSize >= summaryResultCount or the link comes up missing.
            print(f"      {links.get(doc, '(no link - raise --n)')}")
    cits = (meta.get("citationMetadata") or {}).get("citations", [])
    if cits:
        # referenceIndex is 0-based and OMITTED when it is 0, so a bare {}
        # source means reference 1 in the printed numbering.
        print(f"\n{len(cits)} citation spans")
else:
    print("(no summary returned - try --extractive, or the query was judged "
          "non-summary-seeking)")

results = d.get("results", [])
if results:
    print(f"\n=== TOP {min(3, len(results))} RESULTS ===")
    for r in results[:3]:
        sd = r.get("document", {}).get("derivedStructData", {}) or {}
        print(f"  - {sd.get('title', '(untitled)')[:80]}")
        print(f"    {sd.get('link', '(no link)')}")
        for ea in (sd.get("extractive_answers") or [])[:1]:
            snippet = (ea.get("content") or "").strip().replace("\n", " ")
            print(f"    {textwrap.shorten(snippet, 160)}")
PY
