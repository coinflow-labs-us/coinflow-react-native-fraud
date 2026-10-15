import {faker} from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import {CoinflowFraudBuildGradle, CoinflowFraudPodfile} from './app.plugin';
import packageJson from './package.json';

const SIGNAL_REPOS = [
  ['https://jitpack.io', 'com.github.nsure-ai'],
  ['https://maven.fpregistry.io/releases', 'com.fingerprint.android'],
  ['https://us-central1-maven.pkg.dev/verisoul/android', 'ai.verisoul'],
];
const MAVEN_REPO_URLS = SIGNAL_REPOS.map(([url]) => url);

const occurrences = ({contents, text}) => contents.split(text).length - 1;

describe('CoinflowFraudPodfile', () => {
  const target = faker.word.noun();
  const podfile = `target '${target}' do
  use_expo_modules!
  config = use_native_modules!

  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

  const apply = ({contents, localSdkPath}) =>
    CoinflowFraudPodfile.addDeploymentTargetFix(
      CoinflowFraudPodfile.addPods({contents, localSdkPath})
    );

  test('adds only the native SDK, at its release tag, after use_expo_modules!', () => {
    const result = CoinflowFraudPodfile.addPods({contents: podfile});

    expect(result).toBe(
      podfile.replace(
        '  use_expo_modules!\n',
        `  use_expo_modules!\n  pod 'CoinflowFraud', :git => 'https://github.com/coinflow-labs-us/coinflow-swift-fraud.git', :tag => 'v${packageJson.nativeSdkVersions.ios}'\n`
      )
    );
  });

  test('builds the native SDK from a local path when one is given', () => {
    const localSdkPath = `../${faker.system.directoryPath().slice(1)}`;

    const result = CoinflowFraudPodfile.addPods({
      contents: podfile,
      localSdkPath,
    });

    expect(result).toContain(
      `  pod 'CoinflowFraud', :path => '${localSdkPath}'\n`
    );
    expect(result).not.toContain('coinflow-swift-fraud.git');
  });

  test('leaves a pod the app already declares alone', () => {
    const declared = podfile.replace(
      '  use_expo_modules!\n',
      "  use_expo_modules!\n  pod 'CoinflowFraud', :path => '../vendor'\n"
    );

    expect(CoinflowFraudPodfile.addPods({contents: declared})).toBe(declared);
  });

  test('adds the deployment-target fix at the top of post_install', () => {
    const result = CoinflowFraudPodfile.addDeploymentTargetFix(podfile);

    expect(result).toContain(
      "  post_install do |installer|\n    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |build_config|\n        next unless build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1"
    );
    expect(result).toContain("['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'");
  });

  // Bare apps copy the README's block and Expo apps get the plugin's, so they must stay the same.
  test('writes the same block as the README', () => {
    const trimmedLines = text =>
      text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');
    const pluginBlock = CoinflowFraudPodfile.addDeploymentTargetFix(podfile)
      .split('post_install do |installer|\n')[1]
      .split('    react_native_post_install')[0];

    expect(
      trimmedLines(fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8'))
    ).toContain(trimmedLines(pluginBlock));
  });

  test('is idempotent across repeated prebuilds', () => {
    const once = apply({contents: podfile});

    expect(apply({contents: once})).toBe(once);
  });

  test('throws when use_expo_modules! is missing', () => {
    const contents = podfile.replace('  use_expo_modules!\n', '');

    expect(() => CoinflowFraudPodfile.addPods({contents})).toThrow(
      /use_expo_modules!/
    );
  });

  test('throws when post_install is missing', () => {
    const contents = podfile.replace(
      /  post_install do \|installer\|\n.*\n  end\n/,
      ''
    );

    expect(() =>
      CoinflowFraudPodfile.addDeploymentTargetFix(contents)
    ).toThrow(/post_install/);
  });
});

describe('CoinflowFraudBuildGradle', () => {
  const buildGradle = `buildscript {
  repositories {
    google()
  }
}

allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`;

  test('adds every signal SDK repo to allprojects only', () => {
    const result = CoinflowFraudBuildGradle.addMavenRepos({
      contents: buildGradle,
    });
    const allprojects = result.slice(result.indexOf('allprojects'));

    MAVEN_REPO_URLS.forEach(url => {
      expect(occurrences({contents: allprojects, text: `url '${url}'`})).toBe(1);
    });
    expect(result.slice(0, result.indexOf('allprojects'))).not.toContain(
      'maven'
    );
    expect(result).not.toContain('mavenLocal()');
  });

  test('scopes each signal SDK repo to its own group', () => {
    const result = CoinflowFraudBuildGradle.addMavenRepos({
      contents: buildGradle,
    });

    SIGNAL_REPOS.forEach(([url, group]) => {
      expect(result).toContain(
        `    exclusiveContent {\n      forRepository { maven { url '${url}' } }\n      filter { includeGroup '${group}' }\n    }\n`
      );
    });
  });

  test('adds mavenLocal for a native SDK built from source', () => {
    const result = CoinflowFraudBuildGradle.addMavenRepos({
      contents: buildGradle,
      useMavenLocal: true,
    });

    expect(occurrences({contents: result, text: 'mavenLocal()'})).toBe(1);
  });

  test('is idempotent across repeated prebuilds', () => {
    const once = CoinflowFraudBuildGradle.addMavenRepos({
      contents: buildGradle,
      useMavenLocal: true,
    });

    expect(
      CoinflowFraudBuildGradle.addMavenRepos({contents: once, useMavenLocal: true})
    ).toBe(once);
  });

  test('does not duplicate a repo the app already declares', () => {
    const declaredUrl = faker.helpers.arrayElement(MAVEN_REPO_URLS);
    const withDeclared = buildGradle.replace(
      '    google()\n    mavenCentral()',
      `    google()\n    maven { url '${declaredUrl}' }\n    mavenCentral()`
    );

    const result = CoinflowFraudBuildGradle.addMavenRepos({
      contents: withDeclared,
    });

    MAVEN_REPO_URLS.forEach(url => {
      expect(occurrences({contents: result, text: url})).toBe(1);
    });
  });

  test('rejects a Kotlin DSL build file instead of writing Groovy into it', () => {
    expect(() =>
      CoinflowFraudBuildGradle.apply({contents: buildGradle, language: 'kt'})
    ).toThrow(/build\.gradle\.kts is not supported/);
  });

  test('leaves a Kotlin DSL build file that already has every repo alone', () => {
    const complete = CoinflowFraudBuildGradle.addMavenRepos({
      contents: buildGradle,
    });

    expect(
      CoinflowFraudBuildGradle.apply({contents: complete, language: 'kt'})
    ).toBe(complete);
  });

  test('applies the repos to a Groovy build file', () => {
    expect(
      CoinflowFraudBuildGradle.apply({
        contents: buildGradle,
        language: 'groovy',
        useMavenLocal: true,
      })
    ).toBe(
      CoinflowFraudBuildGradle.addMavenRepos({
        contents: buildGradle,
        useMavenLocal: true,
      })
    );
  });

  test('throws when there is no allprojects repositories block', () => {
    const contents = buildGradle.slice(0, buildGradle.indexOf('allprojects'));

    expect(() => CoinflowFraudBuildGradle.addMavenRepos({contents})).toThrow(
      /android\/build\.gradle/
    );
  });
});

// The module's build.gradle must list the same repos the plugin writes, or the Expo and bare install
// paths resolve different signal SDKs.
describe('Android Maven repo list', () => {
  test('android/build.gradle lists the plugin repos, scoped to the same groups', () => {
    const repos = [
      ...fs
        .readFileSync(path.join(__dirname, 'android/build.gradle'), 'utf8')
        .matchAll(/'(https:[^']+)': '([^']+)'/g),
    ].map(match => [match[1], match[2]]);

    expect(repos).toEqual(SIGNAL_REPOS);
  });

  test('android/build.gradle checks the marker the settings plugin sets', () => {
    const plugin = fs.readFileSync(
      path.join(
        __dirname,
        '../android-fraud/coinflow-fraud-repositories/src/main/java/cash/coinflow/fraud/repositories/CoinflowFraudRepositoriesPlugin.java'
      ),
      'utf8'
    );
    expect(plugin).toMatch(/APPLIED_MARKER = "([^"]+)"/);
    const marker = plugin.match(/APPLIED_MARKER = "([^"]+)"/)[1];

    expect(
      fs.readFileSync(path.join(__dirname, 'android/build.gradle'), 'utf8')
    ).toContain(`gradle.ext.has('${marker}')`);
  });
});
