import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { LatLng } from '../models/taripa.models';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly currentPosition = signal<LatLng | null>(null);
  readonly gpsError        = signal<string | null>(null);

  getCurrentPosition(): Observable<LatLng> {
    return new Observable(observer => {
      if (!navigator.geolocation) {
        observer.error('Geolocation is not supported by this browser.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: LatLng = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          this.currentPosition.set(coords);
          this.gpsError.set(null);
          observer.next(coords);
          observer.complete();
        },
        (err) => {
          const msg = this.mapError(err.code);
          this.gpsError.set(msg);
          observer.error(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  watchPosition(): Observable<LatLng> {
    return new Observable(observer => {
      if (!navigator.geolocation) {
        observer.error('Geolocation not supported.');
        return;
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.currentPosition.set(coords);
          observer.next(coords);
        },
        (err) => observer.error(this.mapError(err.code)),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    });
  }

  /** Haversine distance in km between two coordinates */
  distanceKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private mapError(code: number): string {
    switch (code) {
      case 1: return 'Location access denied. Please enable GPS permissions.';
      case 2: return 'Location unavailable. Check your GPS signal.';
      case 3: return 'Location request timed out.';
      default: return 'Unknown location error.';
    }
  }
}
