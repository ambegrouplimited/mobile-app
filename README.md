# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Gmail / Outlook OAuth redirect configuration

Set `EXPO_PUBLIC_GMAIL_REDIRECT_URL` to the HTTPS OAuth bridge endpoint (for example, `https://api.duesoon.app/api/oauth/mobile-redirect`). Both Gmail and Outlook use this value when starting their consent flows.

```bash
export EXPO_PUBLIC_GMAIL_REDIRECT_URL="https://api.duesoon.app/api/oauth/mobile-redirect"
npx expo start
```

When you create standalone builds, update both this variable and the backend `MOBILE_APP_DEEPLINK_URI` to match the final scheme or universal link you’ve registered in Google Cloud Console so the handoff works end-to-end.

### WhatsApp Embedded Signup

WhatsApp onboarding now launches the hosted bridge at `https://app.duesoon.net/whatsapp/connect`, which returns the Meta authorization `code`, WABA ID, phone number ID, and the raw session payload back to the Expo app via the same deep link that `AuthSession.makeRedirectUri` generates (scheme: `ambeduesoon://`). To keep the flow healthy:

- Set the backend `WHATSAPP_EMBEDDED_SIGNUP_URL` to the deployed bridge URL, and make sure it’s whitelisted in Meta’s **Valid OAuth Redirect URIs** and **Allowed Domains for the JavaScript SDK** lists.
- Populate `VITE_WHATSAPP_APP_ID`, `VITE_WHATSAPP_CONFIG_ID`, and `VITE_WHATSAPP_FALLBACK_REDIRECT` in the web app so the bridge loads the correct Facebook Login configuration.
- Double-check that the custom scheme declared in `app.json` (`"scheme": "ambeduesoon"`) is also registered with the mobile OS so the redirect returns to the Expo app.

After the flow returns, the app prompts the user for the 6-digit PIN they set inside Embedded Signup and posts everything to `/api/messaging/whatsapp/onboarding-complete`, which means no more manual copy/paste of tokens.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
