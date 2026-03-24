import { Component, inject, signal, computed, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FareService } from '../../core/services/fare.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { GoogleMapsLoaderService } from '../../core/services/google-maps-loader.service';
import { FareCalculationResult } from '../../core/models/taripa.models';
import { MapPickerComponent, PickedLocation } from '../../shared/components/map-picker/map-picker.component';
import { RouteMapComponent } from '../../shared/components/route-map/route-map.component';

interface LocationResult {
  display_name: string;
  lat?: string;
  lon?: string;
  placeId?: string;
}

export type PassengerType = 'regular' | 'student' | 'senior' | 'pwd' | 'solo_parent';
export type ResiboStep = 'form' | 'resibo';
export type PickingFor = 'origin' | 'dest' | null;
export type PassengerCount = 1 | 2 | 3;

@Component({
  selector: 'app-resibo',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, UpperCasePipe, MapPickerComponent, RouteMapComponent],
  templateUrl: './resibo.component.html',
  styleUrl: './resibo.component.css',
})
export class ResiboComponent implements OnInit {
  private fareService   = inject(FareService);
  private geoService    = inject(GeolocationService);
  private googleLoader  = inject(GoogleMapsLoaderService);
  private ngZone        = inject(NgZone);

  private useGoogle = false;

  step             = signal<ResiboStep>('form');
  result           = signal<FareCalculationResult | null>(null);
  calculating      = signal(false);
  showMatrix       = signal(false);
  isOffline        = signal(!navigator.onLine);
  gettingOriginGps = signal(false);
  error            = signal<string | null>(null);
  locationError    = signal<{ field: 'origin' | 'dest'; msg: string } | null>(null);
  passengerType    = signal<PassengerType>('regular');
  passengerCount   = signal<PassengerCount>(1);
  originCoords     = signal<{ lat: number; lng: number } | null>(null);
  destCoords       = signal<{ lat: number; lng: number } | null>(null);
  pickingFor       = signal<PickingFor>(null);

  originName        = '';
  destName          = '';
  bodyNumberForShare = '';

  // Inline search state
  originQuery     = '';
  destQuery       = '';
  originResults:  LocationResult[] = [];
  destResults:    LocationResult[] = [];
  originSearching = false;
  destSearching   = false;

  private searchTimer: any;

  async ngOnInit() {
    window.addEventListener('online',  () => this.isOffline.set(false));
    window.addEventListener('offline', () => this.isOffline.set(true));

    const gmaps = await this.googleLoader.load();
    this.useGoogle = !!gmaps?.places?.AutocompleteSuggestion;
  }

  searchPlaces(field: 'origin' | 'dest', query: string) {
    const q = query.trim();
    if (q.length < 2) {
      if (field === 'origin') this.originResults = [];
      else                    this.destResults   = [];
      return;
    }
    this.searchTimer = setTimeout(async () => {
      if (field === 'origin') this.originSearching = true;
      else                    this.destSearching   = true;

      const gmaps = (window as any).google?.maps;
      if (this.useGoogle && gmaps) {
        try {
          const { suggestions } = await gmaps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            includedRegionCodes: ['ph'],
          });
          this.ngZone.run(() => {
            const results: LocationResult[] = (suggestions || [])
              .filter((s: any) => s.placePrediction)
              .map((s: any) => ({ display_name: s.placePrediction.text.toString(), placeId: s.placePrediction.placeId }));
            if (field === 'origin') { this.originResults = results; this.originSearching = false; }
            else                    { this.destResults   = results; this.destSearching   = false; }
          });
        } catch {
          this.ngZone.run(() => {
            if (field === 'origin') this.originSearching = false;
            else                    this.destSearching   = false;
          });
        }
      } else {
        // Nominatim fallback — appended with "Angeles City" + strict address filter
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ' Angeles City')}&limit=8&addressdetails=1`;
        fetch(url, { headers: { 'Accept-Language': 'en' } })
          .then(r => r.json())
          .then((data: any[]) => {
            const filtered = data.filter((r: any) => {
              const name = r.display_name.toLowerCase();
              return name.includes('angeles city') || name.includes(', angeles,');
            });
            this.ngZone.run(() => {
              const results: LocationResult[] = filtered.map((r: any) => ({ display_name: r.display_name, lat: r.lat, lon: r.lon }));
              if (field === 'origin') { this.originResults = results; this.originSearching = false; }
              else                    { this.destResults   = results; this.destSearching   = false; }
            });
          })
          .catch(() => {
            this.ngZone.run(() => {
              if (field === 'origin') this.originSearching = false;
              else                    this.destSearching   = false;
            });
          });
      }
    }, 300);
  }

  async pickSearchResult(field: 'origin' | 'dest', r: LocationResult) {
    this.locationError.set(null);
    if (field === 'origin') this.originResults = [];
    else                    this.destResults   = [];

    if (r.placeId) {
      const gmaps = (window as any).google?.maps;
      if (!gmaps) return;
      try {
        const place = new gmaps.places.Place({ id: r.placeId });
        await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'addressComponents'] });
        
        let isActuallyInAngeles = false;
        for (const component of (place.addressComponents || [])) {
          if (component.types?.includes("locality")) {
            const name = component.longText;
            if (name === "Angeles" || name === "Angeles City") {
              isActuallyInAngeles = true;
            }
            break;
          }
        }

        if (!isActuallyInAngeles) {
          this.ngZone.run(() => this.locationError.set({
            field,
            msg: 'That location is outside Angeles City. TARIPA only covers tricycles operating within the city.',
          }));
          return;
        }

        const lat  = place.location.lat();
        const lng  = place.location.lng();
        const name = (place.displayName || place.formattedAddress || r.display_name).split(',').slice(0, 2).join(',').trim();
        this.ngZone.run(() => this.setLocation(field, lat, lng, name));
      } catch { /* place details failed silently */ }
    } else if (r.lat && r.lon) {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      const isAngeles = r.display_name.toLowerCase().includes('angeles city') || r.display_name.toLowerCase().includes(', angeles,');
      if (!isAngeles) {
        this.locationError.set({
          field,
          msg: 'That location is outside Angeles City. TARIPA only covers tricycles operating within the city.',
        });
        return;
      }
      const name = r.display_name.split(',').slice(0, 2).join(',').trim();
      this.setLocation(field, lat, lng, name);
    }
  }

  private setLocation(field: 'origin' | 'dest', lat: number, lng: number, name: string) {
    if (field === 'origin') {
      this.originCoords.set({ lat, lng });
      this.originName  = name;
      this.originQuery = name;
      if (this.pickingFor() === 'origin') this.pickingFor.set(null);
    } else {
      this.destCoords.set({ lat, lng });
      this.destName  = name;
      this.destQuery = name;
      if (this.pickingFor() === 'dest') this.pickingFor.set(null);
    }
  }

  clearField(field: 'origin' | 'dest') {
    this.roadDistanceKm.set(null);
    if (field === 'origin') {
      this.originCoords.set(null);
      this.originName  = '';
      this.originQuery = '';
      this.originResults = [];
    } else {
      this.destCoords.set(null);
      this.destName  = '';
      this.destQuery = '';
      this.destResults = [];
    }
  }

  readonly passengerTypes = [
    { value: 'regular'     as PassengerType, label: 'Regular'     },
    { value: 'student'     as PassengerType, label: 'Student'     },
    { value: 'senior'      as PassengerType, label: 'Senior'      },
    { value: 'pwd'         as PassengerType, label: 'PWD'         },
    { value: 'solo_parent' as PassengerType, label: 'Solo Parent' },
  ];

  readonly passengerCounts: { value: PassengerCount; label: string }[] = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3+' },
  ];

  canCalculate = computed(() => !!this.originCoords() && !!this.destCoords());

  /** Straight-line fallback until OSRM responds */
  previewDistanceKm = computed(() => {
    const o = this.originCoords();
    const d = this.destCoords();
    if (!o || !d) return null;
    return this.geoService.distanceKm(o, d).toFixed(2);
  });

  /** Actual road distance from OSRM — replaces straight-line once loaded */
  roadDistanceKm = signal<number | null>(null);

  onRoadDistanceKm(km: number) {
    this.roadDistanceKm.set(km);
  }

  /** Distance label shown in the info bar */
  displayDistanceKm = computed(() => {
    const road = this.roadDistanceKm();
    return road !== null ? road.toFixed(2) : (this.previewDistanceKm() ?? '—');
  });

  /** Whether the displayed distance is road-accurate or still straight-line */
  isRoadDistance = computed(() => this.roadDistanceKm() !== null);

  /**
   * The ordinance fare covers 1–2 passengers (shared trip fare).
   * For 3+ passengers, no official rate is defined (pakiao).
   * totalFare is always the trip fare for 1–2 pax; for 3+ it is an estimate.
   */
  totalFare = computed(() => {
    const r = this.result();
    return r ? r.computed_fare : 0;
  });

  /** Per-person split when there are 2 passengers */
  splitFare = computed(() => {
    const r = this.result();
    return r ? +(r.computed_fare / 2).toFixed(2) : 0;
  });

  /** Whether to show the pakiao/ambiguity warning */
  showPakiaoWarning = computed(() => this.passengerCount() === 3);

  useMyLocationForOrigin(): void {
    this.gettingOriginGps.set(true);
    this.error.set(null);
    this.geoService.getCurrentPosition().subscribe({
      next: async (pos) => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}&zoom=17&addressdetails=1`;
          const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          
          const city = (data?.address?.city || data?.address?.town || data?.address?.municipality || '').toLowerCase();
          if (city !== 'angeles' && city !== 'angeles city' && !data?.display_name?.toLowerCase().includes('angeles city')) {
            this.error.set('Your current location is outside Angeles City. TARIPA only covers tricycles operating within Angeles City.');
            this.gettingOriginGps.set(false);
            return;
          }

          this.ngZone.run(() => {
            this.originCoords.set(pos);
            this.originName = (data.display_name || 'My Location').split(',').slice(0, 2).join(',').trim();
            this.originQuery = this.originName;
            this.gettingOriginGps.set(false);
            if (this.pickingFor() === 'origin') this.pickingFor.set(null);
          });
        } catch {
          this.error.set('Could not verify your location. Please search for your origin manually.');
          this.gettingOriginGps.set(false);
        }
      },
      error: (msg) => {
        this.error.set(msg);
        this.gettingOriginGps.set(false);
      },
    });
  }

  openPicker(for_: 'origin' | 'dest'): void {
    this.pickingFor.set(this.pickingFor() === for_ ? null : for_);
  }

  async onLocationPicked(loc: PickedLocation) {
    const field = this.pickingFor();
    if (!field) return;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&zoom=17&addressdetails=1`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      
      const city = (data?.address?.city || data?.address?.town || data?.address?.municipality || '').toLowerCase();
      if (city !== 'angeles' && city !== 'angeles city' && !data?.display_name?.toLowerCase().includes('angeles city')) {
        this.locationError.set({
          field,
          msg: 'That location is outside Angeles City. TARIPA only covers tricycles operating within the city.',
        });
        return;
      }

      this.locationError.set(null);
      this.setLocation(field, loc.lat, loc.lng, loc.name);
      this.pickingFor.set(null);
    } catch {
      // Fallback if geocoding fails, at least we try to respect the user's intent but it's risky
      this.locationError.set({ field, msg: 'Could not verify city boundary. Please try searching for the place instead.' });
    }
  }

  calculate(): void {
    const origin = this.originCoords();
    const dest   = this.destCoords();
    if (!origin || !dest) return;

    this.calculating.set(true);
    this.error.set(null);

    const roadKm = this.roadDistanceKm();
    this.fareService.calculateFare({
      origin_lat:        origin.lat,
      origin_lng:        origin.lng,
      dest_lat:          dest.lat,
      dest_lng:          dest.lng,
      passenger_type:    this.passengerType(),
      origin_name:       this.originName || 'Origin',
      dest_name:         this.destName   || 'Destination',
      ...(roadKm !== null ? { road_distance_km: roadKm } : {}),
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.step.set('resibo');
        this.calculating.set(false);
        this.fareService.markResiboGenerated(res.calculation_id).subscribe();
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to calculate fare. Please try again.');
        this.calculating.set(false);
      },
    });
  }

  shareResibo(): void {
    const r = this.result();
    if (!r) return;
    const count = this.passengerCount();
    const fareLine = count === 2
      ? `Trip Fare (1–2 pax): ₱${r.computed_fare} (₱${this.splitFare()} each)`
      : count === 3
        ? `Trip Fare: ₱${r.computed_fare} (3+ pax — pakiao may apply)`
        : `Legal Fare: ₱${r.computed_fare}`;
    const bodyLine = this.bodyNumberForShare.trim()
      ? `\nTricycle Body No.: ${this.bodyNumberForShare.trim().toUpperCase()}`
      : '';
    const text =
      `🛺 TARIPA Resibo — Safe Ride Share\n` +
      `Route: ${r.origin_name} → ${r.dest_name}\n` +
      `Distance: ${r.distance_km} km${bodyLine}\n` +
      `${fareLine}\n` +
      `${r.ordinance_cite}\n\nGenerated by TARIPA — taripa.app`;

    if (navigator.share) {
      navigator.share({ title: 'TARIPA Resibo', text });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert('Resibo copied to clipboard!');
      });
    }
  }

  reset(): void {
    this.step.set('form');
    this.result.set(null);
    this.originCoords.set(null);
    this.destCoords.set(null);
    this.originName = '';
    this.destName   = '';
    this.bodyNumberForShare = '';
    this.originQuery = '';
    this.destQuery   = '';
    this.originResults = [];
    this.destResults   = [];
    this.roadDistanceKm.set(null);
    this.error.set(null);
    this.locationError.set(null);
    this.pickingFor.set(null);
    this.passengerCount.set(1);
  }
}
