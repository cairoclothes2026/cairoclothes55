/** Ask the visitor for permission and return the current coordinates for browser-local use. */
export function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('location_unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED
        ? 'location_denied'
        : error.code === error.TIMEOUT ? 'location_timeout' : 'location_unavailable')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

/** Ask the visitor for permission and return a Google Maps link for their current coordinates. */
export async function getCurrentMapLocation(): Promise<string> {
  const coords = await getCurrentCoordinates();
  return `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
}
