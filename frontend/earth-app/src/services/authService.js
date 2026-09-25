/**
 * authService.js — Demo authentication, credential verification, and geolocation helper.
 */

export const DEMO_EMAIL = 'admin@vadodara.gov.in';
export const DEMO_PASSWORD = 'suraksha2024';

export function verifyDemoCredentials(email, password) {
  if (!email || !password) return false;
  const validUsers = [
    { email: 'admin@vadodara.gov.in', pass: 'suraksha2024' },
    { email: 'admin', pass: 'suraksha2024' },
    { email: 'ndrf@suraksha.in', pass: 'ndrf2024' },
    { email: 'officer@vadodara.gov.in', pass: 'vadodara2024' },
  ];
  return validUsers.some(
    u => u.email.toLowerCase() === email.toLowerCase() && u.pass === password
  );
}

export async function checkVpnHeuristic() {
  // Demo mode: allow local/direct connections without VPN block
  return { flagged: false, raw: { ip: '127.0.0.1', isVpn: false } };
}

export async function requestLoginLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}
