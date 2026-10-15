# @qasimha/react-native-sdk

Qasimha checkout for React Native apps. Your server creates the checkout session with a server
SDK and hands the app a `paymentUrl`; this module presents it in the system browser sheet, detects
the return to your app and resolves a typed result. It also ships `QasimhaPromo`, an instalment
summary for product, cart and checkout screens.

The shape mirrors Tamara's React Native SDK: no secret key on the device, no API call from the app
other than the publishable-key promo request, and the outcome is always confirmed by your server.

## Requirements

- React Native 0.72 or later, React 18 or 19.
- Android: minSdk 24, AndroidX, Kotlin 1.9+, a browser with Custom Tabs (falls back to the default
  browser).
- iOS: 13.4 or later, Swift 5.9. `ASWebAuthenticationSession` with an https return URL needs
  iOS 17.4.
- Optional: `react-native-svg` 13+ for the riyal symbol and the logo in `QasimhaPromo` (see below).

## Install

```sh
npm install @qasimha/react-native-sdk
cd ios && pod install
```

Autolinking registers the native module on both platforms. The New Architecture runs it through
the interop layer; see [New Architecture](#new-architecture).

### Android

1. Declare the custom return scheme the module's `QasimhaReturnActivity` listens on, in
   `android/app/build.gradle`. The build fails without it; set any unused value if you only use
   App Links.

   ```groovy
   android {
     defaultConfig {
       manifestPlaceholders = [qasimhaReturnScheme: "myshop"]
     }
   }
   ```

   `myshop://qasimha/return` then reaches your app. Custom schemes can be claimed by other apps;
   App Links are the secure choice.

2. For App Links (https return URLs), add a verified intent filter to your main activity in
   `AndroidManifest.xml` and publish `/.well-known/assetlinks.json` on that host:

   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https" android:host="shop.example" android:pathPrefix="/qasimha/return" />
   </intent-filter>
   ```

3. Keep `android:launchMode="singleTask"` on the main activity (the React Native template
   default). The return is delivered through `onNewIntent`, which also closes the Custom Tab.

### iOS

1. Custom scheme: add it to `Info.plist`.

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>myshop</string></array>
     </dict>
   </array>
   ```

2. Universal Links: add the Associated Domains capability (`applinks:shop.example`) and publish
   `/.well-known/apple-app-site-association` on that host.

3. Forward links to React Native's `Linking` in `AppDelegate` (Swift shown; the Objective-C
   equivalent calls the same `RCTLinkingManager` methods):

   ```swift
   import React

   func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
     return RCTLinkingManager.application(app, open: url, options: options)
   }

   func application(_ application: UIApplication, continue userActivity: NSUserActivity,
                    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
     return RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
   }
   ```

4. `SFSafariViewController` opens a Universal Link into your app only from a user tap. The hosted
   checkout shows a "Return to store" button on every final screen, so the shopper's tap brings the
   result back; the automatic redirect that follows is shown in the sheet instead. Custom-scheme
   return URLs and `presentation: 'webAuthenticationSession'` return without a tap.

## Usage

```tsx
import { useEffect } from "react";
import { Linking } from "react-native";
import { handleReturn, startCheckout } from "@qasimha/react-native-sdk";

function useQasimhaReturn() {
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) =>
      handleReturn(url),
    );
    Linking.getInitialURL().then((url) => url && handleReturn(url));
    return () => subscription.remove();
  }, []);
}

async function pay(paymentUrl: string) {
  const result = await startCheckout({
    paymentUrl,
    merchantUrl: {
      success: "https://shop.example/qasimha/return?order=1001",
      failure: "https://shop.example/qasimha/return?order=1001",
      cancel: "https://shop.example/cart",
    },
    language: "ar",
  });

  switch (result.type) {
    case "success":
      await confirmOnServer(result.orderId);
      break;
    case "failure":
      showDeclined(result.status);
      break;
    case "cancelled":
      break;
  }
}
```

`merchantUrl` must be the same three URLs your server passed to `POST /pay/session/create`.
The hosted checkout navigates to one of them with `orderId`, `orderReferenceId` and `status`
appended (your own query string is preserved); the module matches scheme, host and path, closes
the sheet and resolves.

### Confirm on your server

A return URL is a navigation, not a proof. Before showing "paid" or fulfilling, ask your server to
read the order with the secret key (`orders.get` in the server SDKs, `GET /merchant/orders/{id}`)
and act on the order status it returns. Your server also receives the webhook, which is the
durable record. Never change an order on the basis of the return URL parameters alone.

### `startCheckout(options): Promise<CheckoutResult>`

| Option         | Type                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentUrl`   | string                                            | Required. The `paymentUrl` from session creation; `https` only.                                                                                                                                                                                                                                                                                                                       |
| `merchantUrl`  | `{ success, failure, cancel }`                    | Required. Each absolute, at most 1024 characters, no fragment; `https`, `http` on `localhost` / `127.0.0.1`, or a custom app scheme of at least three characters (`javascript`, `data`, `file`, `blob`, `vbscript` refused).                                                                                                                                                          |
| `presentation` | `'systemBrowser'` \| `'webAuthenticationSession'` | Default `systemBrowser`: Android Custom Tabs, iOS `SFSafariViewController`. `webAuthenticationSession` (iOS only, Android uses Custom Tabs) presents `ASWebAuthenticationSession` and receives the return URL without any `Linking` wiring; the three return URLs must share one custom scheme, or one https host and path (iOS 17.4+). The session is ephemeral (no shared cookies). |
| `language`     | `'ar'` \| `'en'`                                  | Sent as `Accept-Language` to the Custom Tab. The hosted checkout follows the shopper's browser language and offers an in-page toggle; this hint does not override it today.                                                                                                                                                                                                           |

```ts
type CheckoutResult =
  | { type: "success"; orderId: string; orderReferenceId?: string }
  | {
      type: "failure";
      status: string;
      orderId?: string;
      orderReferenceId?: string;
    }
  | { type: "cancelled" };
```

- `success`: `status=confirmed` with an `orderId`.
- `failure`: `status` is `declined`, `expired` or `failed`; `unknown` when the return URL matched but
  carried no usable status or no `orderId` with `confirmed`. Confirm with your server either way.
- `cancelled`: `status=cancelled`, the cancel URL without a status, or the shopper dismissed the
  sheet. The order stays `AwaitingCheckout` and expires on its own; your server may cancel it.

Rejections are `QasimhaCheckoutError` with a `code`: `INVALID_OPTIONS` (with `field`),
`IN_PROGRESS`, `NATIVE_MODULE_MISSING`, `NO_ACTIVITY`, `NO_VIEW_CONTROLLER`, `NO_BROWSER`,
`UNSUPPORTED`, `PRESENTATION_FAILED`, `HOST_DESTROYED`, `INVALID_URL`, `NATIVE_ERROR`.

One checkout at a time. A dismissed sheet resolves `cancelled` after a 300 ms grace period so a
return URL that is still in flight through `Linking` wins.

### `handleReturn(url): boolean`

Call it from `Linking`'s `url` event and with `getInitialURL()`. Returns `true` when the URL
matched the pending checkout's return URLs (the checkout resolves and the sheet closes), `false`
otherwise, including when no checkout is pending. Keep your own deep-link handling for the
`false` case.

Give the cancel URL a dedicated path: the match is a prefix on the path at a segment boundary,
so a root-path return URL matches every link on that host.

### `parseReturnUrl(url, merchantUrl)` and `validateCheckoutOptions(options)`

The pure functions behind the module, exported for tests and for apps that route the return
themselves.

## `QasimhaPromo`

```tsx
import { QasimhaPromo } from "@qasimha/react-native-sdk";

<QasimhaPromo
  amount={1200}
  publicKey="pk_live_XXXXXXXX"
  lang="ar"
  textStyle={{ fontSize: 16, color: "#1f2937" }}
/>;
```

Renders the Qasimha logo followed by "قسّمها على 4 دفعات شهرية بقيمة [symbol] 300" (or "Split
into 4 monthly payments of [symbol] 300") from `GET {apiBaseUrl}/api/v1/widget/plans?amount=1200.00&currency=SAR&lang=ar`
with header `X-Public-Key`, `credentials: 'omit'`, a 5 s timeout, no cookies and no storage. The
headline plan is the first entry of `plans`; a trust line ("Interest-free · Sharia-compliant")
follows when the plan is flagged Sharia-compliant.

| Prop                 | Type                             | Notes                                                                                                                                                                           |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amount`             | number \| string                 | Required. Positive, at most two decimals; strings must match `^\d{1,9}(\.\d{1,2})?$`.                                                                                           |
| `publicKey`          | string                           | Required. `pk_test_…` or `pk_live_…`.                                                                                                                                           |
| `lang`               | `'ar'` \| `'en'`                 | Default `'ar'`.                                                                                                                                                                 |
| `apiBaseUrl`         | string                           | Default by key prefix: `pk_live_` → `https://api.qasimha.com`, `pk_test_` → `https://merchant-api-uat.qasimha.com`. Must be `https`; `http` for `localhost` / `127.0.0.1` only. |
| `renderSymbol`       | `({ size, color }) => ReactNode` | Your own riyal symbol node (an `Image`, an icon font glyph, your SVG).                                                                                                          |
| `showLogo`           | boolean                          | Default `true`: the Qasimha logo at the start of the line, 1.45 em high.                                                                                                        |
| `onLearnMore`        | `() => void`                     | When given, a "المزيد" / "Learn more" link follows the trust line, in the darker brand coral `#b9431f` (`PROMO_LINK_COLOR`). Open your own explainer from it.                   |
| `onPlan`             | `(plan \| null) => void`         | Called with the headline plan once the quote arrives, or `null` when the component renders nothing; use it to hide a surrounding card.                                          |
| `style`, `textStyle` |                                  | Container and text styles; the symbol takes its size (0.82 em) and colour from `textStyle`.                                                                                     |

### Logo

`QasimhaLogo` (`height`, `lang`, `style`) is the official logotype: the coral (`#fd6c43`) pill
with «قسّمها» in cream, drawn with `react-native-svg` when the app has it. Without it the logo
falls back to a coral pill with the wordmark as text (قسّمها, or Qasimha in English). The promo
uses the same component.

### Money rendering

Money is the Saudi riyal symbol to the left of the number in Arabic and English alike, in a row
with `direction: 'ltr'` (on Android Paper, which ignores `direction`, the row is reversed under
an RTL app instead), Latin digits, thousands separator, decimals only when the halalas are
non-zero: `1,200`, `300.50`. The word ريال, the codes SAR/SR and U+FDFC never appear as visible
text; they are used only in the accessibility label.

The symbol itself:

1. `renderSymbol`, when you pass it.
2. Otherwise `react-native-svg`, when it is installed in the app. It is an optional peer
   dependency resolved at runtime with `require` inside `try`/`catch`; the two reference paths
   are drawn in the text colour. Metro's `resolver.allowOptionalDependencies` is `false` by
   default and an app without `react-native-svg` may then fail to bundle on that `require`;
   either install `react-native-svg` or set the Metro option to `true`.
3. Otherwise a text-free `View` with the glyph's aspect ratio, hidden from accessibility, so the
   layout is stable and nothing wrong is ever shown. Use `renderSymbol` to fill it.

### Fail closed

The component renders nothing, never a computed or fallback number, when the key, amount or
`apiBaseUrl` is invalid, the request fails or times out, the status is not 2xx, the envelope is
not `success: true` with `currency: 'SAR'` and at least one well-formed plan, or the amount is
outside `[minAmount, maxAmount]`. Place it on product, cart and checkout screens rather than in
every row of a list; each mounted instance issues one request.

## New Architecture

The module is a legacy `NativeModules` bridge module and runs under the New Architecture through
the interop layer (React Native 0.74+ enables it by default). `src/NativeQasimhaCheckout.ts` is a
codegen-ready `TurboModule` spec of the same two methods (`open`, `close`); the package does not
declare `codegenConfig`, so no code is generated today. JavaScript resolves the module through
`TurboModuleRegistry.get` with a `NativeModules` fallback, which covers both bridge and bridgeless
apps.

## Security

- The app holds no secret. The checkout session is created on your server; the only credential
  in the app is the publishable key for the promo, which the API scopes to reading plans.
- TLS validation is the platform's; there is no option to disable it and no certificate pinning.
- No storage, no analytics, no device fingerprinting. Nothing is written to logs.
- PCI DSS: no card data passes through your app; card entry happens on the hosted checkout and
  the PSP. Merchants integrating this module stay in SAQ-A scope.
- Application shielding: we recommend root/jailbreak detection, anti-tamper and runtime
  protection for merchant apps that present payments. The module does not perform them; use a
  RASP product or the platform's integrity APIs.
- Consumer R8 rules are shipped; symbols are stripped in your release build with the rest of the
  app.

Report a vulnerability privately to Qasimha Integration Support (customercare@qasimha.com) rather
than in a public issue.

## Demo app

[`demo/`](demo/README.md) is a complete React Native store (Android verified, iOS configured)
that pays with Qasimha through this module: product, cart and checkout screens with
`QasimhaPromo`, `startCheckout` against a demo merchant backend, the return through `Linking`
and `handleReturn`, and the server-side confirmation. Start there.

`example/App.tsx` is the minimal version: a single screen where you paste a `paymentUrl` created
by your server, tap "Pay with Qasimha" and read the result.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build      # lib/ (CommonJS + declarations)
```

Native code is compiled by the consuming app. `android/` is a Gradle library module resolved by
autolinking; `QasimhaCheckout.podspec` is picked up by `pod install`.
