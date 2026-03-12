import {
  Component, inject, signal, OnInit, OnDestroy,
  AfterViewInit, ViewChild, ElementRef, NgZone, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FareService } from '../../core/services/fare.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { GoogleMapsLoaderService } from '../../core/services/google-maps-loader.service';
import { Terminal, LatLng } from '../../core/models/taripa.models';
import { Subscription } from 'rxjs';
import type { Map as LMap, Marker } from 'leaflet';

export interface TerminalWithDistance extends Terminal {
  distanceM?: number;
  nearbyAlert?: boolean;
}

@Component({
  selector: 'app-bantay-batas',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './bantay-batas.component.html',
  styleUrl: './bantay-batas.component.css',
})
export class BantayBatasComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private fareService  = inject(FareService);
  private geoService   = inject(GeolocationService);
  private googleLoader = inject(GoogleMapsLoaderService);
  private ngZone       = inject(NgZone);
  private platformId   = inject(PLATFORM_ID);

  terminals    = signal<TerminalWithDistance[]>([]);
  myPosition   = signal<LatLng | null>(null);
  gpsLoading   = signal(false);
  gpsError     = signal<string | null>(null);
  loading      = signal(true);
  nearbyAlerts = signal<TerminalWithDistance[]>([]);

  private geoSub?: Subscription;

  // Google Maps
  private useGoogle        = false;
  private gMap: any;
  private gTerminalMarkers: any[] = [];
  private gUserMarker: any;

  // Leaflet fallback
  private map?: LMap;
  private L?: typeof import('leaflet');
  private terminalMarkers: Marker[] = [];
  private userMarker?: Marker;

  get sortedTerminals(): TerminalWithDistance[] {
    return [...this.terminals()].sort((a, b) => b.reports_last_7d - a.reports_last_7d);
  }

  ngOnInit(): void {
    this.fareService.getTerminals().subscribe({
      next: (list) => {
        this.terminals.set(list);
        this.loading.set(false);
        this.drawTerminalMarkers();
      },
      error: () => this.loading.set(false),
    });
  }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const gmaps = await this.googleLoader.load();
    if (gmaps) {
      this.useGoogle = true;
      this.initGoogleMap(gmaps);
    } else {
      this.useGoogle = false;
      await this.initLeafletMap();
    }
  }

  ngOnDestroy(): void {
    this.geoSub?.unsubscribe();
    this.map?.remove();
  }

  // ── Google Maps ────────────────────────────────────────────

  private initGoogleMap(gmaps: any) {
    this.ngZone.runOutsideAngular(() => {
      this.gMap = new gmaps.Map(this.mapEl.nativeElement, {
        center: { lat: 15.1509, lng: 120.5918 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
    });
    if (this.terminals().length > 0) this.drawTerminalMarkers();
  }

  private terminalPinIcon(color: string, count: number): any {
    const gmaps = (window as any).google.maps;
    const label = count > 0 ? String(count) : '✓';
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
        <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 24 18 24s18-10.5 18-24C36 8.059 27.941 0 18 0z"
              fill="${color}" stroke="white" stroke-width="2"/>
        <text x="18" y="23" text-anchor="middle" font-size="13" font-weight="bold" fill="white" font-family="sans-serif">${label}</text>
      </svg>`
    );
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new gmaps.Size(36, 42),
      anchor: new gmaps.Point(18, 42),
    };
  }

  private userDotIcon(): any {
    const gmaps = (window as any).google.maps;
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#2563eb" stroke="white" stroke-width="2.5"/>
        <circle cx="10" cy="10" r="3" fill="white"/>
      </svg>`
    );
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new gmaps.Size(20, 20),
      anchor: new gmaps.Point(10, 10),
    };
  }

  private drawGoogleTerminalMarkers() {
    if (!this.gMap) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    this.gTerminalMarkers.forEach(m => m.setMap(null));
    this.gTerminalMarkers = [];

    const infoWindow = new gmaps.InfoWindow();

    for (const t of this.terminals()) {
      const isHot  = t.reports_last_7d >= 5;
      const isWarm = t.reports_last_7d >= 1;
      const color  = isHot ? '#D44035' : isWarm ? '#d97706' : '#16a34a';
      const content = t.reports_last_7d > 0
        ? `<b>${t.name}</b><br>${t.barangay}<br><span style="color:${color}">${t.reports_last_7d} report(s) this week</span>`
        : `<b>${t.name}</b><br>${t.barangay}<br><span style="color:#16a34a">No recent reports ✓</span>`;

      this.ngZone.runOutsideAngular(() => {
        const marker = new gmaps.Marker({
          position: { lat: t.lat, lng: t.lng },
          map: this.gMap,
          icon: this.terminalPinIcon(color, t.reports_last_7d),
          title: t.name,
        });
        marker.addListener('click', () => {
          infoWindow.setContent(content);
          infoWindow.open(this.gMap, marker);
        });
        this.gTerminalMarkers.push(marker);
      });
    }
  }

  private placeGoogleUserMarker(pos: LatLng) {
    if (!this.gMap) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;
    this.gUserMarker?.setMap(null);
    const infoWindow = new gmaps.InfoWindow({ content: '<b>You are here</b>' });
    this.ngZone.runOutsideAngular(() => {
      this.gUserMarker = new gmaps.Marker({
        position: { lat: pos.lat, lng: pos.lng },
        map: this.gMap,
        icon: this.userDotIcon(),
        title: 'You are here',
      });
      this.gUserMarker.addListener('click', () => infoWindow.open(this.gMap, this.gUserMarker));
    });
  }

  // ── Leaflet fallback ───────────────────────────────────────

  private async initLeafletMap() {
    const L = await import('leaflet');
    this.L = L;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl:       'assets/leaflet/marker-icon.png',
      shadowUrl:     'assets/leaflet/marker-shadow.png',
    });

    this.ngZone.runOutsideAngular(() => {
      this.map = L.map(this.mapEl.nativeElement, { scrollWheelZoom: false })
        .setView([15.1509, 120.5918], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.map);
    });

    if (this.terminals().length > 0) this.drawTerminalMarkers();
  }

  private drawLeafletTerminalMarkers() {
    if (!this.L || !this.map) return;
    const L = this.L;

    this.terminalMarkers.forEach(m => m.remove());
    this.terminalMarkers = [];

    for (const t of this.terminals()) {
      const isHot  = t.reports_last_7d >= 5;
      const isWarm = t.reports_last_7d >= 1;
      const color  = isHot ? '#D44035' : isWarm ? '#d97706' : '#16a34a';

      const icon = L.divIcon({
        className: '',
        html: `<div class="bb-pin" style="--pin-color:${color}">
                 <span class="bb-pin-count">${t.reports_last_7d}</span>
               </div>`,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
      });

      const label = t.reports_last_7d > 0
        ? `<b>${t.name}</b><br>${t.barangay}<br><span style="color:${color}">${t.reports_last_7d} report(s) this week</span>`
        : `<b>${t.name}</b><br>${t.barangay}<br><span style="color:#16a34a">No recent reports ✓</span>`;

      const marker = L.marker([t.lat, t.lng], { icon })
        .addTo(this.map!)
        .bindPopup(label);

      this.terminalMarkers.push(marker);
    }
  }

  private placeLeafletUserMarker(pos: LatLng) {
    if (!this.L || !this.map) return;
    if (this.userMarker) this.userMarker.remove();

    const icon = this.L.divIcon({
      className: '',
      html: `<div class="bb-pin-user"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    this.userMarker = this.L.marker([pos.lat, pos.lng], { icon })
      .addTo(this.map)
      .bindPopup('<b>You are here</b>');
  }

  // ── Shared ─────────────────────────────────────────────────

  private drawTerminalMarkers() {
    if (this.useGoogle) this.drawGoogleTerminalMarkers();
    else                this.drawLeafletTerminalMarkers();
  }

  enableGps(): void {
    this.gpsLoading.set(true);
    this.gpsError.set(null);
    this.geoSub = this.geoService.getCurrentPosition().subscribe({
      next: async (pos) => {
        // Validate user is inside Angeles City via reverse geocode
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}&zoom=10&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          const city = (data?.address?.city || data?.address?.town || data?.address?.municipality || '').toLowerCase();
          if (!city.includes('angeles')) {
            this.ngZone.run(() => {
              this.gpsError.set('Your location is outside Angeles City. TARIPA only covers tricycles operating within the city.');
              this.gpsLoading.set(false);
            });
            return;
          }
        } catch { /* if reverse geocode fails, allow through */ }

        this.ngZone.run(() => {
          this.myPosition.set(pos);
          this.gpsLoading.set(false);
          this.computeDistances(pos);
          if (this.useGoogle) {
            this.placeGoogleUserMarker(pos);
            this.ngZone.runOutsideAngular(() => {
              this.gMap?.setCenter({ lat: pos.lat, lng: pos.lng });
              this.gMap?.setZoom(14);
            });
          } else {
            this.placeLeafletUserMarker(pos);
            this.map?.setView([pos.lat, pos.lng], 14);
          }
        });
      },
      error: (msg) => {
        this.gpsError.set(msg);
        this.gpsLoading.set(false);
      },
    });
  }

  private computeDistances(pos: LatLng): void {
    const ALERT_RADIUS_M = 300;
    const updated = this.terminals().map(t => {
      const distM = this.geoService.distanceKm(pos, { lat: t.lat, lng: t.lng }) * 1000;
      return {
        ...t,
        distanceM:   Math.round(distM),
        nearbyAlert: distM <= ALERT_RADIUS_M && t.reports_last_7d >= 3,
      };
    });
    this.terminals.set(updated);
    this.nearbyAlerts.set(updated.filter(t => t.nearbyAlert));
    this.ngZone.run(() => this.drawTerminalMarkers());
  }
}
