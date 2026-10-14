#!/usr/bin/env bash
# Size analysis of a release AAB: what Play will actually serve per device, and
# what the bytes are made of. Markdown report goes to stdout (CI appends it to
# the job summary). Usage: scripts/analyze-aab.sh path/to/app-release.aab
set -euo pipefail

AAB="${1:?usage: analyze-aab.sh <app.aab>}"
BUNDLETOOL_VERSION="1.18.1"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

JAR="$WORK/bundletool.jar"
curl -sSfL -o "$JAR" \
  "https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar"
bt() { java -jar "$JAR" "$@"; }

mb() { awk -v b="$1" 'BEGIN { printf "%.2f MB", b / 1048576 }'; }

echo "## AAB size analysis"
echo
echo "**File:** \`$(basename "$AAB")\` — $(mb "$(stat -c %s "$AAB")") (upload size, not what users download)"
echo

# --- Estimated download size per device profile --------------------------------
bt build-apks --bundle="$AAB" --output="$WORK/out.apks" --overwrite >/dev/null

echo "### Estimated download size on Play"
echo
echo "| Device profile | Download (min – max) |"
echo "|---|---|"
profiles=(
  "arm64-v8a|xxhdpi|Modern phone (arm64, xxhdpi)"
  "armeabi-v7a|xhdpi|Older phone (armv7, xhdpi)"
  "x86_64|xxhdpi|Emulator / x86_64"
)
for p in "${profiles[@]}"; do
  IFS='|' read -r abi dens label <<<"$p"
  case "$dens" in xhdpi) d=320 ;; xxhdpi) d=480 ;; *) d=480 ;; esac
  cat >"$WORK/spec.json" <<EOF
{"supportedAbis":["$abi"],"supportedLocales":["en"],"screenDensity":$d,"sdkVersion":34}
EOF
  line="$(bt get-size total --apks="$WORK/out.apks" --device-spec="$WORK/spec.json" | tail -n 1)"
  min="${line%%,*}"
  max="${line##*,}"
  echo "| $label | $(mb "$min") – $(mb "$max") |"
done
echo

# --- Composition ---------------------------------------------------------------
mkdir -p "$WORK/aab"
unzip -q -o "$AAB" -d "$WORK/aab"
base="$WORK/aab/base"

section_size() { # dir -> bytes (uncompressed)
  if [ -d "$1" ]; then du -sb "$1" | cut -f1; else echo 0; fi
}

echo "### Base module composition (uncompressed)"
echo
echo "| Part | Size |"
echo "|---|---|"
echo "| dex (Java/Kotlin code) | $(mb "$(section_size "$base/dex")") |"
echo "| lib (native libraries, all ABIs) | $(mb "$(section_size "$base/lib")") |"
echo "| assets | $(mb "$(section_size "$base/assets")") |"
echo "| res | $(mb "$(section_size "$base/res")") |"
echo "| resources.pb + manifest | $(mb "$(( $(stat -c %s "$base/resources.pb" 2>/dev/null || echo 0) + $(section_size "$base/manifest") ))") |"
echo

if [ -d "$base/lib" ]; then
  echo "### Native libraries per ABI"
  echo
  for abi in "$base"/lib/*/; do
    echo "<details><summary><b>$(basename "$abi")</b> — $(mb "$(section_size "$abi")")</summary>"
    echo
    echo '```'
    find "$abi" -name '*.so' -printf '%s %f\n' | sort -rn | head -15 |
      awk '{ printf "%8.2f MB  %s\n", $1 / 1048576, $2 }'
    echo '```'
    echo "</details>"
    echo
  done
fi

echo "### 25 largest files in the base module"
echo
echo '```'
find "$base" -type f -printf '%s %P\n' | sort -rn | head -25 |
  awk '{ printf "%8.2f MB  %s\n", $1 / 1048576, $2 }'
echo '```'
echo

# --- res/ and dex detail ---------------------------------------------------------
if [ -d "$base/res" ]; then
  echo "### res/ by folder (uncompressed)"
  echo
  echo '```'
  du -b --max-depth=1 "$base/res" | sort -rn | grep -v "$base/res$" | head -12 |
    awk '{ n=$2; sub(".*/res/","",n); printf "%8.2f MB  %s\n", $1 / 1048576, n }'
  echo '```'
  echo
fi

echo "### dex by package (R8 output, approx. method count)"
echo
APKANALYZER="$(command -v apkanalyzer || ls "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}"/cmdline-tools/*/bin/apkanalyzer 2>/dev/null | head -n 1 || true)"
if [ -n "$APKANALYZER" ]; then
  bt build-apks --bundle="$AAB" --output="$WORK/uni.apks" --mode=universal --overwrite >/dev/null
  unzip -q -o "$WORK/uni.apks" universal.apk -d "$WORK"
  MAP="$(ls android/app/build/outputs/mapping/release/mapping.txt 2>/dev/null || true)"
  # packages: P/C/M/F  state  #defined  refs  size ; keep depth-3 package rows
  "$APKANALYZER" dex packages ${MAP:+--proguard-mappings "$MAP"} --defined-only "$WORK/universal.apk" 2>/dev/null |
    awk -F'\t' '$1 == "P" { n = split($6, a, "."); if (n <= 3) print $3 "\t" $6 }' |
    sort -rn | head -25 |
    awk -F'\t' '{ printf "%8d methods  %s\n", $1, $2 }' | sed '1i ```' | sed '$a ```'
else
  echo "_apkanalyzer not found; skipped._"
fi
echo

# --- Known heavy dependencies --------------------------------------------------
echo "### Heavy dependency check"
echo
echo "| Dependency | Found |"
echo "|---|---|"
hermes="$(find "$base" -type f -name 'libhermes*.so' | wc -l)"
echo "| Hermes engine libs | $hermes |"
