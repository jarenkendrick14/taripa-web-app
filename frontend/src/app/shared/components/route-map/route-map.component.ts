import {
  Component, Input, Output, EventEmitter,
  AfterViewInit, OnDestroy, OnChanges,
  SimpleChanges, ElementRef, ViewChild, NgZone, PLATFORM_ID, inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { GoogleMapsLoaderService } from '../../../core/services/google-maps-loader.service';
import type { Map as LeafletMap } from 'leaflet';

@Component({
  selector: 'app-route-map',
  standalone: true,
  imports: [],
  template: `<div #mapEl class="route-map-el"></div>`,
  styleUrl: './route-map.component.css',
})
export class RouteMapComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef<HTMLDivElement>;

  @Input() originLat!: number;
  @Input() originLng!: number;
  @Input() originLabel = 'Origin';
  @Input() destLat!: number;
  @Input() destLng!: number;
  @Input() destLabel = 'Destination';

  @Output() roadDistanceKm = new EventEmitter<number>();

  private platformId   = inject(PLATFORM_ID);
  private ngZone       = inject(NgZone);
  private googleLoader = inject(GoogleMapsLoaderService);

  // Google Maps
  private useGoogle     = false;
  private gMap: any;
  private gOrigin: any;
  private gDest: any;
  private gPolyline: any;
  private gFallback: any;

  // Leaflet fallback
  private leafletMap?: LeafletMap;
  private L?: typeof import('leaflet');

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
    if (this.useGoogle && this.gMap)             this.drawGoogle();
    else if (!this.useGoogle && this.leafletMap) this.drawLeaflet();
  }

  ngOnDestroy() {
    this.leafletMap?.remove();
  }

  // ── Google Maps ────────────────────────────────────────────

  private initGoogleMap(gmaps: any) {
    const mid = { lat: (this.originLat + this.destLat) / 2, lng: (this.originLng + this.destLng) / 2 };
    this.ngZone.runOutsideAngular(() => {
      this.gMap = new gmaps.Map(this.mapEl.nativeElement, {
        center: mid, zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
    });
    this.drawGoogle();
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

  private drawGoogle() {
    const gmaps = (window as any).google?.maps;
    if (!gmaps || !this.gMap) return;

    // Remove old overlays
    this.gOrigin?.setMap(null);
    this.gDest?.setMap(null);
    this.gPolyline?.setMap(null);
    this.gFallback?.setMap(null);

    this.ngZone.runOutsideAngular(() => {
      this.gOrigin = new gmaps.Marker({
        position: { lat: this.originLat, lng: this.originLng },
        map: this.gMap, icon: this.pinIcon('#2563eb'), title: this.originLabel,
      });
      this.gDest = new gmaps.Marker({
        position: { lat: this.destLat, lng: this.destLng },
        map: this.gMap, icon: this.pinIcon('#D44035'), title: this.destLabel,
      });

      // Dashed fallback line while route loads
      this.gFallback = new gmaps.Polyline({
        path: [
          { lat: this.originLat, lng: this.originLng },
          { lat: this.destLat,   lng: this.destLng   },
        ],
        map: this.gMap,
        strokeColor: '#D44035', strokeOpacity: 0, strokeWeight: 3,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.35, scale: 4 }, offset: '0', repeat: '20px' }],
      });

      const bounds = new gmaps.LatLngBounds();
      bounds.extend({ lat: this.originLat, lng: this.originLng });
      bounds.extend({ lat: this.destLat,   lng: this.destLng   });
      this.gMap.fitBounds(bounds, 56);
    });

    // Fetch road route from backend proxy (Google Maps → OSRM fallback)
    const url = `${environment.apiUrl}/route`
      + `?origin_lat=${this.originLat}&origin_lng=${this.originLng}`
      + `&dest_lat=${this.destLat}&dest_lng=${this.destLng}`;

    fetch(url)
      .then(r => r.json())
      .then((data: any) => {
        if (!data.polyline?.length) return;
        const path = (data.polyline as [number, number][]).map(([lat, lng]) => ({ lat, lng }));

        this.ngZone.runOutsideAngular(() => {
          const gm = (window as any).google.maps;
          if (data.origin_snapped) this.gOrigin?.setPosition({ lat: data.origin_snapped[0], lng: data.origin_snapped[1] });
          if (data.dest_snapped)   this.gDest?.setPosition({ lat: data.dest_snapped[0],   lng: data.dest_snapped[1]   });

          this.gFallback?.setMap(null);
          this.gPolyline = new gm.Polyline({
            path, map: this.gMap,
            strokeColor: '#D44035', strokeOpacity: 0.9, strokeWeight: 5,
          });

          const b = new gm.LatLngBounds();
          path.forEach((p: any) => b.extend(p));
          this.gMap.fitBounds(b, 56);
        });

        const km = parseFloat((data.distance_m / 1000).toFixed(2));
        this.ngZone.run(() => this.roadDistanceKm.emit(km));
      })
      .catch(() => { /* fallback dashed line stays */ });
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

    const midLat = (this.originLat + this.destLat) / 2;
    const midLng = (this.originLng + this.destLng) / 2;

    this.ngZone.runOutsideAngular(() => {
      this.leafletMap = L.map(this.mapEl.nativeElement, {
        zoomControl: true, dragging: true, scrollWheelZoom: false,
      }).setView([midLat, midLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.leafletMap!);
    });

    this.drawLeaflet();
  }

  private drawLeaflet() {
    if (!this.L || !this.leafletMap) return;
    const L = this.L;

    this.leafletMap.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) layer.remove();
    });

    const originIcon = L.divIcon({ className: '', html: `<div class="map-pin map-pin-origin"></div>`, iconSize: [20, 20], iconAnchor: [10, 20] });
    const destIcon   = L.divIcon({ className: '', html: `<div class="map-pin map-pin-dest"></div>`,   iconSize: [20, 20], iconAnchor: [10, 20] });

    const originMarker = L.marker([this.originLat, this.originLng], { icon: originIcon }).addTo(this.leafletMap!).bindPopup(this.originLabel);
    const destMarker   = L.marker([this.destLat,   this.destLng  ], { icon: destIcon   }).addTo(this.leafletMap!).bindPopup(this.destLabel);

    const fallback = L.polyline(
      [[this.originLat, this.originLng], [this.destLat, this.destLng]],
      { color: '#D44035', weight: 3, opacity: 0.35, dashArray: '6, 6' }
    ).addTo(this.leafletMap!);
    this.leafletMap!.fitBounds(fallback.getBounds(), { padding: [36, 36] });

    const url = `${environment.apiUrl}/route`
      + `?origin_lat=${this.originLat}&origin_lng=${this.originLng}`
      + `&dest_lat=${this.destLat}&dest_lng=${this.destLng}`;

    fetch(url)
      .then(r => r.json())
      .then((data: any) => {
        if (!data.polyline?.length) return;
        const latlngs: [number, number][] = data.polyline;

        this.ngZone.runOutsideAngular(() => {
          if (data.origin_snapped) originMarker.setLatLng(data.origin_snapped as [number, number]);
          if (data.dest_snapped)   destMarker.setLatLng(data.dest_snapped   as [number, number]);
          fallback.remove();
          const road = L.polyline(latlngs, { color: '#D44035', weight: 5, opacity: 0.85 }).addTo(this.leafletMap!);
          this.leafletMap!.fitBounds(road.getBounds(), { padding: [36, 36] });
        });

        const km = parseFloat((data.distance_m / 1000).toFixed(2));
        this.ngZone.run(() => this.roadDistanceKm.emit(km));
      })
      .catch(() => {});
  }
}
