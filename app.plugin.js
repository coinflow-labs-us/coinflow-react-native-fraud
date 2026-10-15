const {withDangerousMod, withProjectBuildGradle} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const {nativeSdkVersions} = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

const IOS_SDK_GIT_URL =
  'https://github.com/coinflow-labs-us/coinflow-swift-fraud.git';

// A signal SDK's resource-bundle target declares iOS 14.0, below current Xcode's minimum (15.0), which
// fails the build. Lift every pod below this package's own minimum to it. The README's bare React Native
// step shows the same block.
const MIN_IOS = '15.1';
const DEPLOYMENT_TARGET_MARKER = `['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}`;
const DEPLOYMENT_TARGET_FIX = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        next unless build_config.build_settings${DEPLOYMENT_TARGET_MARKER}
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
      end
    end
`;

// `expo run:android` passes --configure-on-demand, which skips repos a library adds through
// rootProject.allprojects (android/build.gradle). Write them into the app's own allprojects block.
// Each repo serves only its signal SDK's group, so the app's other dependencies are never requested from
// it. Same groups as android/build.gradle and the cash.coinflow.fraud.repositories settings plugin.
const MAVEN_REPOS = [
  {url: 'https://jitpack.io', group: 'com.github.nsure-ai'},
  {url: 'https://maven.fpregistry.io/releases', group: 'com.fingerprint.android'},
  {url: 'https://us-central1-maven.pkg.dev/verisoul/android', group: 'ai.verisoul'},
].map(({url, group}) => ({
  marker: url,
  block: `    exclusiveContent {
      forRepository { maven { url '${url}' } }
      filter { includeGroup '${group}' }
    }
`,
}));
const MAVEN_LOCAL_REPO = {marker: 'mavenLocal()', block: '    mavenLocal()\n'};
const ALLPROJECTS_REPOSITORIES_ANCHOR =
  /(allprojects\s*\{\s*\n\s*repositories\s*\{\s*\n)/;

const EXPO_MODULES_ANCHOR = /(use_expo_modules!.*\n)/;
const POST_INSTALL_ANCHOR = /(post_install do \|installer\|\n)/;

class NativeFileAnchor {
  static assert({contents, anchor, file}) {
    if (anchor.test(contents)) return;
    throw new Error(
      `@coinflowlabs/react-native-fraud: could not find ${anchor} in ${file}; apply the native setup manually (see README).`
    );
  }
}

class CoinflowFraudPodfile {
  // localSdkPath (relative to ios/) builds the native SDK from source instead of its git tag.
  static podLines({localSdkPath}) {
    const sdkSource = localSdkPath
      ? `:path => '${localSdkPath}'`
      : `:git => '${IOS_SDK_GIT_URL}', :tag => 'v${nativeSdkVersions.ios}'`;
    return [{name: 'CoinflowFraud', line: `  pod 'CoinflowFraud', ${sdkSource}`}];
  }

  // The native SDK isn't on CocoaPods trunk, so point the app's Podfile at its source. A pod the app
  // already declares is left alone.
  static addPods({contents, localSdkPath}) {
    const missing = CoinflowFraudPodfile.podLines({localSdkPath}).filter(
      ({name}) => !contents.includes(`pod '${name}'`)
    );
    if (!missing.length) return contents;
    NativeFileAnchor.assert({
      contents,
      anchor: EXPO_MODULES_ANCHOR,
      file: 'ios/Podfile',
    });
    return contents.replace(
      EXPO_MODULES_ANCHOR,
      `$1${missing.map(({line}) => `${line}\n`).join('')}`
    );
  }

  static addDeploymentTargetFix(contents) {
    if (contents.includes(DEPLOYMENT_TARGET_MARKER)) return contents;
    NativeFileAnchor.assert({
      contents,
      anchor: POST_INSTALL_ANCHOR,
      file: 'ios/Podfile',
    });
    return contents.replace(
      POST_INSTALL_ANCHOR,
      `$1${DEPLOYMENT_TARGET_FIX}`
    );
  }
}

class CoinflowFraudBuildGradle {
  static apply({contents, language, useMavenLocal}) {
    if (!CoinflowFraudBuildGradle.missingRepos({contents, useMavenLocal}).length)
      return contents;
    if (language !== 'groovy')
      throw new Error(
        '@coinflowlabs/react-native-fraud: android/build.gradle.kts is not supported; add the Maven repos manually (see README).'
      );
    return CoinflowFraudBuildGradle.addMavenRepos({contents, useMavenLocal});
  }

  // Each repo is checked on its own: apps often already declare one of them by hand.
  static addMavenRepos({contents, useMavenLocal}) {
    const missing = CoinflowFraudBuildGradle.missingRepos({
      contents,
      useMavenLocal,
    });
    if (!missing.length) return contents;
    NativeFileAnchor.assert({
      contents,
      anchor: ALLPROJECTS_REPOSITORIES_ANCHOR,
      file: 'android/build.gradle',
    });
    return contents.replace(
      ALLPROJECTS_REPOSITORIES_ANCHOR,
      `$1${missing.map(({block}) => block).join('')}`
    );
  }

  // mavenLocal serves a native SDK published from source (./gradlew publishToMavenLocal).
  static missingRepos({contents, useMavenLocal}) {
    const repos = useMavenLocal ? [MAVEN_LOCAL_REPO, ...MAVEN_REPOS] : MAVEN_REPOS;
    return repos.filter(({marker}) => !contents.includes(marker));
  }
}

const withCoinflowFraudAndroid = (config, {localSdkRoot}) =>
  withProjectBuildGradle(config, config => {
    config.modResults.contents = CoinflowFraudBuildGradle.apply({
      contents: config.modResults.contents,
      language: config.modResults.language,
      useMavenLocal: !!localSdkRoot,
    });
    return config;
  });

const withCoinflowFraudIos = (config, {localSdkRoot}) =>
  withDangerousMod(config, [
    'ios',
    async config => {
      const {projectRoot, platformProjectRoot} = config.modRequest;
      const localSdkPath = localSdkRoot
        ? path.relative(
            platformProjectRoot,
            path.resolve(projectRoot, localSdkRoot, 'lib/swift-fraud')
          )
        : undefined;
      const podfile = path.join(platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      fs.writeFileSync(
        podfile,
        CoinflowFraudPodfile.addDeploymentTargetFix(
          CoinflowFraudPodfile.addPods({contents, localSdkPath})
        )
      );
      return config;
    },
  ]);

// localSdkRoot (Coinflow-internal) points at a checkout of the Coinflow monorepo, relative to the app,
// so the testbench builds the native SDKs from source before they are released.
const withCoinflowFraud = (config, {localSdkRoot} = {}) =>
  withCoinflowFraudAndroid(withCoinflowFraudIos(config, {localSdkRoot}), {
    localSdkRoot,
  });

module.exports = withCoinflowFraud;
module.exports.CoinflowFraudPodfile = CoinflowFraudPodfile;
module.exports.CoinflowFraudBuildGradle = CoinflowFraudBuildGradle;
