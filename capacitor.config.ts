import type { CapacitorConfig } from "@capacitor/cli";

// The APK is a WebView shell that loads the deployed CaptureWeb site.
// Everything (UI + screenshot API + auth) runs on the server, so the app
// works exactly like the website — same origin, cookies included.
const config: CapacitorConfig = {
  appId: "com.williamlodge.captureweb",
  appName: "CaptureWeb",
  server: {
    url: "https://PLACEHOLDER.ok.kimi.link",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
