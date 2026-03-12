import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Loads the Google Maps JS API once and caches the result.
 * Returns the `google.maps` namespace, or null if the key is
 * absent or the script fails to load (Leaflet fallback will be used).
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadPromise: Promise<any | null> | null = null;

  load(): Promise<any | null> {
    if (!this.loadPromise) this.loadPromise = this.fetchAndLoad();
    return this.loadPromise;
  }

  private async fetchAndLoad(): Promise<any | null> {
    try {
      const res = await fetch(`${environment.apiUrl}/config`);
      const cfg = await res.json();
      const key = cfg?.googleMapsApiKey;
      if (!key) return null;

      await new Promise<void>((resolve, reject) => {
        // Already loaded (e.g. HMR)
        if ((window as any).google?.maps) { resolve(); return; }
        const script    = document.createElement('script');
        script.src      = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=beta`;
        script.async    = true;
        script.defer    = true;
        script.onload   = () => resolve();
        script.onerror  = () => reject(new Error('Google Maps script failed to load'));
        document.head.appendChild(script);
      });

      return (window as any).google.maps;
    } catch {
      return null;
    }
  }
}
