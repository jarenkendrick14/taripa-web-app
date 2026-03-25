import {
  Component, Input, Output, EventEmitter,
  AfterViewInit, OnDestroy, OnChanges, SimpleChanges,
  ElementRef, ViewChild, NgZone, PLATFORM_ID, inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsLoaderService } from '../../../core/services/google-maps-loader.service';
import type { Map, Marker } from 'leaflet';

export interface PickedLocation {
  lat: number;
  lng: number;
  name: string;
}

interface SearchResult {
  label: string;
  placeId?: string;  // Google Places
  lat?: number;      // Nominatim
  lng?: number;
}

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="map-picker-wrap">
      <!-- Search bar -->
      <div class="map-search-bar">
        <input
          class="map-search-input"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchInput($event)"
          (keydown.enter)="search()"
          placeholder="Search a place in Angeles City..."
          type="search" />
        <button class="map-search-btn" (click)="search()" [disabled]="searching">
          @if (searching) {
            <span class="map-spinner"></span>
          } @else {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          }
        </button>
      </div>

      <!-- Search results dropdown -->
      @if (searchResults.length > 0) {
        <div class="map-search-results">
          @for (r of searchResults; track r.label) {
            <button class="map-result-item" (click)="selectResult(r)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {{ r.label }}
            </button>
          }
        </div>
      }

      <!-- Map container -->
      <div #mapEl class="map-el"></div>

      @if (outOfBoundsError) {
        <p class="map-hint map-hint-error">That location is outside Angeles City. Please pick a location within the city.</p>
      } @else if (pendingPick) {
        <div class="map-confirm-bar">
          <div class="map-confirm-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{{ pendingPick.name }}</span>
          </div>
          <div class="map-confirm-actions">
            <button class="map-confirm-btn" (click)="confirmPick()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12l5 5L20 7"/>
              </svg>
              Confirm
            </button>
            <button class="map-cancel-btn" (click)="cancelPick()">Change</button>
          </div>
        </div>
      } @else if (picked) {
        <div class="map-picked-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>
          </svg>
          <span>{{ picked.name }}</span>
        </div>
      } @else {
        <p class="map-hint">Tap the map to pin a location</p>
      }
    </div>
  `,
  styleUrl: './map-picker.component.css',
})
export class MapPickerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef<HTMLDivElement>;

  @Input() initialLat = 15.1509;
  @Input() initialLng = 120.5918;
  @Input() zoom = 14;
  @Input() markerLabel = 'Location';
  @Input() fixedMarkerLat?: number;
  @Input() fixedMarkerLng?: number;
  @Input() fixedMarkerLabel = 'Origin';

  @Output() locationPicked = new EventEmitter<PickedLocation>();

  private platformId   = inject(PLATFORM_ID);
  private ngZone       = inject(NgZone);
  private googleLoader = inject(GoogleMapsLoaderService);

  // Angeles City administrative boundary — OSM relation 9386775 (admin_level=6)
  private readonly BOUNDS = { latMin: 15.1081703, latMax: 15.1794119, lngMin: 120.4780711, lngMax: 120.6371543 };

  // Google Maps
  private useGoogle       = false;
  private gMap: any;
  private gMarker: any;
  private gFixedMarker: any;
  private gGeocoder: any;

  // Leaflet fallback
  private leafletMap?: Map;
  private L?: typeof import('leaflet');
  private lMarker?: Marker;
  private lFixedMarker?: Marker;

  picked: PickedLocation | null = null;
  pendingPick: PickedLocation | null = null;
  outOfBoundsError = false;
  searchQuery   = '';
  searchResults: SearchResult[] = [];
  searching     = false;
  private searchTimer: any;

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

  ngOnChanges(changes: SimpleChanges) {
    if (this.useGoogle && this.gMap) {
      if ((changes['fixedMarkerLat'] || changes['fixedMarkerLng']) &&
          this.fixedMarkerLat !== undefined && this.fixedMarkerLng !== undefined) {
        this.placeGoogleFixedMarker(this.fixedMarkerLat, this.fixedMarkerLng);
      }
    } else if (this.L && this.leafletMap) {
      if ((changes['fixedMarkerLat'] || changes['fixedMarkerLng']) &&
          this.fixedMarkerLat !== undefined && this.fixedMarkerLng !== undefined) {
        this.placeLeafletFixedMarker(this.fixedMarkerLat, this.fixedMarkerLng);
      }
    }
  }

  ngOnDestroy() {
    this.leafletMap?.remove();
  }

  // ── Google Maps ────────────────────────────────────────────

  private initGoogleMap(gmaps: any) {
    this.ngZone.runOutsideAngular(() => {
      this.gMap = new gmaps.Map(this.mapEl.nativeElement, {
        center: { lat: this.initialLat, lng: this.initialLng },
        zoom: this.zoom,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });

      this.gMap.addListener('click', (e: any) => {
        this.ngZone.run(() => this.onGoogleMapClick(e.latLng.lat(), e.latLng.lng()));
      });
    });

    this.gGeocoder = new gmaps.Geocoder();

    if (this.fixedMarkerLat !== undefined && this.fixedMarkerLng !== undefined) {
      this.placeGoogleFixedMarker(this.fixedMarkerLat, this.fixedMarkerLng);
    }
  }

  private pinIcon(color: string): any {
    const gmaps = (window as any).google.maps;
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="28" viewBox="0 0 22 28">
        <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 17 11 17s11-8.75 11-17C22 4.925 17.075 0 11 0z"
              fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="11" cy="10" r="3.5" fill="white"/>
      </svg>`
    );
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new gmaps.Size(22, 28),
      anchor: new gmaps.Point(11, 28),
    };
  }

  private onGoogleMapClick(lat: number, lng: number) {
    this.outOfBoundsError = false;
    this.placeGoogleMarker(lat, lng, 'Getting address...', false);
    this.gGeocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      const name = (status === 'OK' && results?.[0])
        ? results[0].formatted_address.split(',').slice(0, 2).join(',').trim()
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      this.ngZone.run(() => this.placeGoogleMarker(lat, lng, name, true));
    });
  }

  private placeGoogleMarker(lat: number, lng: number, name: string, emit: boolean) {
    const gmaps = (window as any).google.maps;
    this.gMarker?.setMap(null);
    this.ngZone.runOutsideAngular(() => {
      this.gMarker = new gmaps.Marker({
        position: { lat, lng }, map: this.gMap,
        icon: this.pinIcon('#D44035'), title: name,
      });
    });
    this.picked = { lat, lng, name };
    if (emit) this.locationPicked.emit(this.picked);
    this.ngZone.runOutsideAngular(() => this.gMap.panTo({ lat, lng }));
  }

  private placeGoogleFixedMarker(lat: number, lng: number) {
    const gmaps = (window as any).google.maps;
    this.gFixedMarker?.setMap(null);
    this.ngZone.runOutsideAngular(() => {
      this.gFixedMarker = new gmaps.Marker({
        position: { lat, lng }, map: this.gMap,
        icon: this.pinIcon('#2563eb'), title: this.fixedMarkerLabel,
      });
    });
  }

  // ── Leaflet fallback ───────────────────────────────────────

  private async initLeafletMap() {
    const leafletModule = await import('leaflet');
    const L = (leafletModule as any).default ?? leafletModule;
    this.L = L;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl:       'assets/leaflet/marker-icon.png',
      shadowUrl:     'assets/leaflet/marker-shadow.png',
    });

    const { latMin, latMax, lngMin, lngMax } = this.BOUNDS;
    this.ngZone.runOutsideAngular(() => {
      this.leafletMap = L.map(this.mapEl.nativeElement, {
        zoomControl: true,
        maxBounds: [[latMin, lngMin], [latMax, lngMax]],
        maxBoundsViscosity: 1.0,
      }).setView([this.initialLat, this.initialLng], this.zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.leafletMap!);

      this.leafletMap!.on('click', (e: any) => {
        this.ngZone.run(() => this.onLeafletClick(e.latlng.lat, e.latlng.lng));
      });
    });

    if (this.fixedMarkerLat !== undefined && this.fixedMarkerLng !== undefined) {
      this.placeLeafletFixedMarker(this.fixedMarkerLat, this.fixedMarkerLng);
    }
  }

  private async onLeafletClick(lat: number, lng: number) {
    this.outOfBoundsError = false;
    this.placeLeafletMarker(lat, lng, 'Checking location...', false);
    const { name, inAngeles } = await this.reverseGeocodeNominatim(lat, lng);
    if (!inAngeles) {
      this.ngZone.run(() => {
        this.outOfBoundsError = true;
        this.lMarker?.remove();
        this.pendingPick = null;
      });
      return;
    }
    this.ngZone.run(() => this.placeLeafletMarker(lat, lng, name, false));
    this.ngZone.run(() => { this.pendingPick = { lat, lng, name }; });
  }

  private placeLeafletMarker(lat: number, lng: number, name: string, emit: boolean) {
    if (!this.L || !this.leafletMap) return;
    this.lMarker?.remove();
    const icon = this.L.divIcon({ className: '', html: `<div class="map-pin map-pin-dest"></div>`, iconSize: [20, 20], iconAnchor: [10, 20] });
    this.lMarker = this.L.marker([lat, lng], { icon }).addTo(this.leafletMap).bindPopup(name).openPopup();
    this.picked  = { lat, lng, name };
    if (emit) this.locationPicked.emit(this.picked);
    this.leafletMap.panTo([lat, lng]);
  }

  private placeLeafletFixedMarker(lat: number, lng: number) {
    if (!this.L || !this.leafletMap) return;
    this.lFixedMarker?.remove();
    const icon = this.L.divIcon({ className: '', html: `<div class="map-pin map-pin-origin"></div>`, iconSize: [20, 20], iconAnchor: [10, 20] });
    this.lFixedMarker = this.L.marker([lat, lng], { icon }).addTo(this.leafletMap).bindPopup(this.fixedMarkerLabel);
  }

  private async reverseGeocodeNominatim(lat: number, lng: number): Promise<{ name: string; inAngeles: boolean }> {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      const city = (data?.address?.city || data?.address?.town || data?.address?.municipality || '').toLowerCase();
      const inAngeles = city.includes('angeles');
      const name = data?.display_name ? data.display_name.split(',').slice(0, 2).join(',').trim() : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      return { name, inAngeles };
    } catch { /* silent */ }
    return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, inAngeles: false };
  }

  private isInAngelesCityGoogle(place: any): boolean {
    for (const comp of (place.addressComponents || [])) {
      if (comp.types?.includes('locality')) {
        const name = (comp.longText || '').toLowerCase();
        return name === 'angeles' || name === 'angeles city';
      }
    }
    return false;
  }

  // ── Search ─────────────────────────────────────────────────

  onSearchInput(query: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.search(query), 300);
  }

  async search(query = this.searchQuery) {
    const q = query.trim();
    if (q.length < 2) { this.searchResults = []; return; }
    this.searching = true;
    this.searchResults = [];
    if (this.useGoogle) {
      this.searchGooglePlaces(q);
    } else {
      await this.searchNominatim(q);
    }
  }

  private async searchGooglePlaces(q: string) {
    const gmaps = (window as any).google?.maps;
    if (!gmaps?.places?.AutocompleteSuggestion) { this.searching = false; return; }
    const { latMin, latMax, lngMin, lngMax } = this.BOUNDS;
    try {
      const { suggestions } = await gmaps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        locationRestriction: { north: latMax, south: latMin, east: lngMax, west: lngMin },
        includedRegionCodes: ['ph'],
      });
      this.ngZone.run(() => {
        this.searching = false;
        this.searchResults = (suggestions || [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            label: s.placePrediction.text.toString(),
            placeId: s.placePrediction.placeId,
          }));
      });
    } catch {
      this.ngZone.run(() => { this.searching = false; });
    }
  }

  private async searchNominatim(q: string) {
    try {
      const url  = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&viewbox=120.50,15.25,120.70,15.05&bounded=1&limit=8&addressdetails=1`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      this.ngZone.run(() => {
        this.searchResults = data.map((r: any) => ({
          label: r.display_name,
          lat:   parseFloat(r.lat),
          lng:   parseFloat(r.lon),
        }));
        this.searching = false;
      });
    } catch {
      this.ngZone.run(() => { this.searching = false; });
    }
  }

  async selectResult(r: SearchResult) {
    this.searchResults  = [];
    this.outOfBoundsError = false;
    this.searchQuery    = r.label.split(',').slice(0, 2).join(',').trim();

    if (r.placeId) {
      const gmaps = (window as any).google?.maps;
      if (!gmaps) return;
      try {
        const place = new gmaps.places.Place({ id: r.placeId });
        await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'addressComponents'] });
        if (!this.isInAngelesCityGoogle(place)) {
          this.ngZone.run(() => {
            this.outOfBoundsError = true;
            this.searchQuery = '';
          });
          return;
        }
        const lat  = place.location.lat();
        const lng  = place.location.lng();
        const name = (place.displayName || place.formattedAddress || r.label).split(',').slice(0, 2).join(',').trim();
        this.ngZone.run(() => {
          this.searchQuery = name;
          this.placeGoogleMarker(lat, lng, name, false);
          this.pendingPick = { lat, lng, name };
        });
        this.ngZone.runOutsideAngular(() => this.gMap?.panTo({ lat, lng }));
        this.ngZone.runOutsideAngular(() => this.gMap?.setZoom(16));
      } catch { /* place details failed */ }
    } else if (r.lat !== undefined && r.lng !== undefined) {
      if (!r.label.toLowerCase().includes('angeles')) {
        this.outOfBoundsError = true;
        this.searchQuery = '';
        return;
      }
      const name = r.label.split(',').slice(0, 2).join(',').trim();
      this.ngZone.runOutsideAngular(() => this.leafletMap?.setView([r.lat!, r.lng!], 16));
      this.placeLeafletMarker(r.lat, r.lng, name, false);
      this.pendingPick = { lat: r.lat, lng: r.lng, name };
    }
  }

  confirmPick() {
    if (!this.pendingPick) return;
    this.picked = this.pendingPick;
    this.pendingPick = null;
    this.locationPicked.emit(this.picked);
  }

  cancelPick() {
    this.pendingPick = null;
    this.gMarker?.setMap(null);
    this.lMarker?.remove();
    this.searchQuery = '';
  }
}
