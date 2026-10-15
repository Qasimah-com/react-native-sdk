# Changelog

All notable changes to `@qasimha/react-native-sdk` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `QasimhaLogo`: the official Qasimha logotype (coral `#fd6c43` pill with «قسّمها»), drawn with
  `react-native-svg` when installed and falling back to a coral text pill with the wordmark.
- `QasimhaPromo` props `showLogo` (default `true`), `onLearnMore` (a "Learn more" link in the
  darker coral `#b9431f`, exported as `PROMO_LINK_COLOR`) and `onPlan` (the headline plan, or
  `null` when nothing is rendered).

### Changed

- `QasimhaPromo` follows the current Qasimha identity of the web widget: the logo leads the
  summary line, with the trust line beneath.

### Fixed

- Android: the module compiles against current React Native (checked on 0.87), where
  `ReactContextBaseJavaModule.currentActivity` is gone; it reads the activity from the
  `ReactApplicationContext`. Java and Kotlin both target 17, matching the toolchain the React
  Native Gradle plugin applies, so the build no longer fails on mismatched JVM targets.

## [0.1.0] - 2026-09-25

### Added

- `startCheckout(options)`: presents a hosted checkout `paymentUrl` in the system browser sheet
  (Android Custom Tabs, iOS `SFSafariViewController`; `ASWebAuthenticationSession` on request)
  and resolves a typed `CheckoutResult` (`success`, `failure`, `cancelled`) from the merchant
  return URL, per the return-URL contract: prefix match on scheme, host and path; `orderId`,
  `orderReferenceId` and `status` read from the query string; the merchant's own query string
  preserved.
- `handleReturn(url)` for App Links / Universal Links and custom-scheme returns delivered through
  `Linking`; closes the sheet and settles the pending checkout.
- Local validation of `paymentUrl` (https only) and `merchantUrl` (absolute, at most 1024
  characters, no fragment, `https`, `http` on `localhost` / `127.0.0.1`, or a custom app scheme
  of at least three characters outside the reserved set).
- `QasimhaPromo`: instalment summary fed by `GET /api/v1/widget/plans` with the publishable key,
  rendered with the riyal symbol to the left of the number inside a left-to-right row in Arabic and
  English alike; fails closed on any invalid input or response. The symbol is drawn with
  `react-native-svg` when the app has it, through `renderSymbol` when supplied, and as a
  text-free placeholder of the glyph's aspect ratio otherwise.
- Android module in Kotlin (`androidx.browser` Custom Tabs, `QasimhaReturnActivity` behind the
  `qasimhaReturnScheme` manifest placeholder, consumer ProGuard rules) and iOS module in Swift
  (privacy manifest declaring no tracking), both on the legacy `NativeModules` bridge with a
  codegen-ready spec in `src/NativeQasimhaCheckout.ts` for the New Architecture interop layer.
- No secret key on the device, no storage, no analytics, no certificate pinning; TLS validation
  is the platform's.
