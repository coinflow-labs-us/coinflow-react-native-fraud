const {withAppDelegate, withInfoPlist} = require('expo/config-plugins');

// iOS 27 refuses to launch apps built with its SDK that haven't adopted the UIScene lifecycle, and
// Expo 54's template still creates its window in the AppDelegate. Move window creation into a
// SceneDelegate so the example launches on iOS 27 devices. internal/testbench/expo has a copy; change
// both together.
const WINDOW_SETUP = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // Cold-start links arrive on the scene, not in didFinishLaunching's launch options. Rebuild the
    // keys RCTLinkingManager reads so Linking.getInitialURL() still sees them.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url { launchOptions[.url] = url }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // UIKit stops calling the AppDelegate's URL handlers once scenes are adopted. Forward to them so
  // URLs still reach ExpoAppDelegate subscribers (via super) and then RCTLinkingManager.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let context = URLContexts.first,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApplication = context.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

class SceneLifecycleAppDelegate {
  static apply(contents) {
    if (contents.includes('class SceneDelegate')) return contents;
    if (!contents.includes(WINDOW_SETUP))
      throw new Error(
        'withSceneLifecycle: AppDelegate.swift no longer matches the Expo 54 template; update the plugin.'
      );
    return contents.replace(WINDOW_SETUP, '') + SCENE_DELEGATE;
  }
}

const withSceneLifecycle = config => {
  config = withInfoPlist(config, config => {
    config.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return config;
  });
  return withAppDelegate(config, config => {
    config.modResults.contents = SceneLifecycleAppDelegate.apply(
      config.modResults.contents
    );
    return config;
  });
};

module.exports = withSceneLifecycle;
