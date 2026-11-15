/**
 * Extends app.json at build time.
 *
 * Google Maps key for react-native-maps in production Android builds (and iOS if the Google
 * provider is chosen). Read from the environment (`GOOGLE_MAPS_API_KEY` in the git-ignored
 * `.env` or an EAS secret) so it is never committed. Expo Go needs no key.
 *
 * The key ends up inside the app binary, as with every mobile Maps key: restrict it in Google
 * Cloud to this app's package name and signing certificate (SHA-1), and to the Maps SDKs only.
 */
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) return config;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: googleMapsApiKey,
          iosGoogleMapsApiKey: googleMapsApiKey,
        },
      ],
    ],
  };
};
