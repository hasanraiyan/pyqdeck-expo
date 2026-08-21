const {
  withMainActivity,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULE_SOURCE = (pkg) => `package ${pkg}

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class VolumeScrollModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    @Volatile
    @JvmStatic
    var enabled: Boolean = false

    @Volatile
    @JvmStatic
    var instance: VolumeScrollModule? = null
  }

  init {
    instance = this
  }

  override fun getName() = "VolumeScrollModule"

  fun emit(direction: String) {
    if (reactContext.hasActiveCatalystInstance()) {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onVolumeButtonPress", direction)
    }
  }

  @ReactMethod
  fun setEnabled(value: Boolean) {
    enabled = value
  }

  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}
}
`;

const PACKAGE_SOURCE = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class VolumeScrollPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(VolumeScrollModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

// Writes the two Kotlin source files (native module + ReactPackage) into the
// generated android project. Runs on every `expo prebuild` since /android is
// gitignored and rebuilt from scratch in CI.
function withVolumeScrollSources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pkg = config.android.package;
      const pkgDir = pkg.replace(/\./g, '/');
      const srcDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        pkgDir
      );
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'VolumeScrollModule.kt'), MODULE_SOURCE(pkg));
      fs.writeFileSync(path.join(srcDir, 'VolumeScrollPackage.kt'), PACKAGE_SOURCE(pkg));
      return config;
    },
  ]);
}

// Registers VolumeScrollPackage in MainApplication's package list.
function withVolumeScrollPackageRegistration(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('VolumeScrollPackage()')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {\n          add(VolumeScrollPackage())`
      );
    }
    config.modResults.contents = contents;
    return config;
  });
}

// Intercepts hardware volume-key events at the Activity level so they can be
// consumed (blocking the system volume change + toast) instead of forwarded,
// but only while VolumeScrollModule.enabled is true.
function withVolumeScrollKeyIntercept(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('import android.view.KeyEvent')) {
      contents = contents.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.view.KeyEvent'
      );
    }

    if (!contents.includes('dispatchKeyEvent')) {
      const override = `
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (VolumeScrollModule.enabled &&
        (event.keyCode == KeyEvent.KEYCODE_VOLUME_UP || event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
      if (event.action == KeyEvent.ACTION_DOWN) {
        VolumeScrollModule.instance?.emit(
          if (event.keyCode == KeyEvent.KEYCODE_VOLUME_UP) "up" else "down"
        )
      }
      return true
    }
    return super.dispatchKeyEvent(event)
  }
`;
      contents = contents.replace(
        /\n\}\s*$/,
        `\n${override}}\n`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withVolumeScroll(config) {
  config = withVolumeScrollSources(config);
  config = withVolumeScrollPackageRegistration(config);
  config = withVolumeScrollKeyIntercept(config);
  return config;
};
