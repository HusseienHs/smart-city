import * as ExpoCrypto from 'expo-crypto';

import {
  installWebCryptoPolyfill,
  verifyWebCrypto,
  type CryptoBackend,
  type WebCryptoReport,
} from './web-crypto-polyfill';

/** expo-crypto: native CSPRNG and SHA-256 on iOS/Android, bundled in Expo Go. */
export const expoCryptoBackend: CryptoBackend = {
  getRandomValues: (array) =>
    ExpoCrypto.getRandomValues(array as unknown as Uint8Array) as unknown as typeof array,
  sha256: (data) =>
    ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data as Uint8Array<ArrayBuffer>),
};

let report: WebCryptoReport | null = null;

/**
 * Makes secure PKCE possible before the Supabase client is created. Safe to call repeatedly;
 * throws instead of letting Supabase fall back to Math.random() or the plain challenge.
 */
export function ensureWebCrypto(): WebCryptoReport {
  if (report) return report;
  report = installWebCryptoPolyfill(expoCryptoBackend);
  if (process.env.NODE_ENV === 'development') void logDiagnostic(report);
  return report;
}

/** Development only: what the runtime offered, what was added, and a SHA-256 self-check. */
async function logDiagnostic(installReport: WebCryptoReport) {
  const before = Object.entries(installReport.before)
    .map(([name, present]) => `${name}=${present ? 'native' : 'missing'}`)
    .join(' ');
  const added = installReport.installed.length > 0 ? installReport.installed.join(', ') : 'none';
  try {
    const check = await verifyWebCrypto();
    const status = check.sha256 && check.randomValues ? 'OK' : 'FAILED';
    const message = `[web-crypto] runtime: ${before} | polyfilled: ${added} | SHA-256 self-check: ${status}`;
    // eslint-disable-next-line no-console -- development-only diagnostic of the device runtime
    if (status === 'OK') console.info(message);
    else console.error(message, check);
  } catch (error) {
    console.error(
      `[web-crypto] runtime: ${before} | polyfilled: ${added} | self-check threw`,
      error,
    );
  }
}
