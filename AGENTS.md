# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Builds

NEVER use `eas build` / `eas submit` - this repo does not use EAS Build. All Android releases are built by the GitHub Actions workflow in `.github/workflows/release.yml` (manual `workflow_dispatch` with input `build_type`: `aab` | `apk` | `both`). It bumps `app.json` `expo.android.versionCode`, runs `expo prebuild --clean`, then `./gradlew assembleRelease` / `bundleRelease` with the release keystore, and commits the bumped versionCode back.
