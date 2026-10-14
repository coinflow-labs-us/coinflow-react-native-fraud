require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'CoinflowReactNativeFraud'
  s.version       = package['version']
  s.summary       = package['description']
  s.homepage      = 'https://coinflow.cash'
  s.license       = package['license']
  s.authors       = 'Coinflow Labs'
  s.platforms     = { :ios => '15.1' }
  s.source        = { :git => package['repository']['url'], :tag => s.version.to_s }
  s.source_files  = 'ios/**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'

  # The native iOS SDK and one of its signal SDKs aren't on CocoaPods trunk; the app's Podfile points
  # them at their git sources (app.plugin.js does this for Expo apps).
  s.dependency 'CoinflowFraud', package['nativeSdkVersions']['ios']

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
