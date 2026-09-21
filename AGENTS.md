# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Prefer Expo libraries over native code

Always reach for an official Expo package first (`expo-*`, `expo-build-properties`, `expo-modules-core`, config plugins from the Expo SDK). This applies to everything: device APIs, permissions, notifications, file/media access, and Android/iOS build configuration (Gradle/ProGuard/Info.plist settings go through `expo-build-properties` in `app.json`, not hand-written files).

Only fall back to native code (a custom config plugin under `plugins/`, an Expo Module with Kotlin/Swift, or patching `android/`/`ios/` output) when the Expo library genuinely cannot do what is needed and you have confirmed that against the versioned docs. When you do, keep the native change minimal, isolate it in a config plugin so it survives `expo prebuild --clean`, and note in the commit message why the Expo route did not work.

# Builds

NEVER use `eas build` / `eas submit` - this repo does not use EAS Build. All Android releases are built by the GitHub Actions workflow in `.github/workflows/release.yml` (manual `workflow_dispatch` with input `build_type`: `aab` | `apk` | `both`). It bumps `app.json` `expo.android.versionCode`, runs `expo prebuild --clean`, then `./gradlew assembleRelease` / `bundleRelease` with the release keystore, and commits the bumped versionCode back.
