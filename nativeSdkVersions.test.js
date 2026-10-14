import fs from 'fs';
import path from 'path';
import packageJson from './package.json';

// The podspec and build.gradle pin the native SDKs from nativeSdkVersions; a stale pin would make the
// published package resolve an old pod tag or Maven artifact.
const read = relativePath =>
  fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

describe('nativeSdkVersions', () => {
  const {ios, android} = packageJson.nativeSdkVersions;

  test('matches the iOS SDK version', () => {
    expect(read('../swift-fraud/VERSION').trim()).toBe(ios);
  });

  test('matches the Android SDK version', () => {
    expect(
      read('../android-fraud/gradle.properties').match(
        /^VERSION_NAME=(.+)$/m
      )?.[1]
    ).toBe(android);
  });

  test('matches the versions in the README install snippets', () => {
    const readme = read('README.md');

    expect(readme).toContain(`:tag => 'v${ios}'`);
    expect(read('../android-fraud/README.md')).toContain(
      `cash.coinflow:coinflow-fraud:${android}`
    );
  });
});
