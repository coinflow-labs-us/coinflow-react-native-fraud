import {faker} from '@faker-js/faker';
import {CoinflowFraudBuildGradle, CoinflowFraudPodfile} from './app.plugin';
import packageJson from './package.json';

const MAVEN_REPO_URLS = [
  'https://jitpack.io',
  'https://maven.fpregistry.io/releases',
  'https://us-central1-maven.pkg.dev/verisoul/android',
];

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
    CoinflowFraudPodfile.addVerisoulDeploymentTargetFix(
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

  test('adds the Verisoul deployment-target fix at the top of post_install', () => {
    const result = CoinflowFraudPodfile.addVerisoulDeploymentTargetFix(podfile);

    expect(result).toContain(
      "  post_install do |installer|\n    installer.pods_project.targets.each do |target|\n      next unless target.name.start_with?('VerisoulSDK')"
    );
    expect(result).toContain("['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'");
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
      CoinflowFraudPodfile.addVerisoulDeploymentTargetFix(contents)
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
