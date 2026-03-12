import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ReportService } from '../../core/services/report.service';
import { GeolocationService } from '../../core/services/geolocation.service';

@Component({
  selector: 'app-safe-ride',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './safe-ride.component.html',
  styleUrl: './safe-ride.component.css',
})
export class SafeRideComponent {
  auth          = inject(AuthService);
  reportService = inject(ReportService);
  geoService    = inject(GeolocationService);

  bodyNumber   = '';
  originName   = '';
  destName     = '';
  contactName  = '';
  contactPhone = '';
  editingContact = false;

  originCoords: { lat: number; lng: number } | null = null;

  gettingGps    = signal(false);
  sending       = signal(false);
  savingContact = signal(false);
  error         = signal<string | null>(null);
  success       = signal<string | null>(null);

  get canShare(): boolean {
    return (!!this.originName || !!this.originCoords)
      && !!this.destName
      && !!this.auth.user()?.trusted_contact_name;
  }

  get previewMessage(): string {
    const u  = this.auth.user();
    const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    return (
      `TARIPA Safe Ride Alert\n\n` +
      `From: ${u?.display_name ?? 'A friend'}\n` +
      `Body No.: ${this.bodyNumber || 'Not provided'}\n` +
      `Boarded at: ${this.originName || 'Current location'}\n` +
      `Going to: ${this.destName}\n` +
      `Timestamp: ${ts}\n\n` +
      `Powered by TARIPA — taripa.app`
    );
  }

  getMyLocation(): void {
    this.gettingGps.set(true);
    this.geoService.getCurrentPosition().subscribe({
      next: (pos) => {
        this.originCoords = pos;
        if (!this.originName) this.originName = 'My current location';
        this.gettingGps.set(false);
      },
      error: (msg) => { this.error.set(msg); this.gettingGps.set(false); },
    });
  }

  saveContact(): void {
    this.savingContact.set(true);
    this.auth.updateTrustedContact(this.contactName, this.contactPhone).subscribe({
      next:  () => { this.savingContact.set(false); this.editingContact = false; },
      error: () => this.savingContact.set(false),
    });
  }

  shareSafeRide(): void {
    this.sending.set(true);
    this.error.set(null);
    this.success.set(null);

    const u = this.auth.user();
    this.reportService.logSafeRide({
      body_number:           this.bodyNumber   || undefined,
      origin_name:           this.originName   || undefined,
      destination_name:      this.destName     || undefined,
      origin_lat:            this.originCoords?.lat,
      origin_lng:            this.originCoords?.lng,
      trusted_contact_name:  u?.trusted_contact_name,
      trusted_contact_phone: u?.trusted_contact_phone,
    }).subscribe({
      next: () => {
        this.sending.set(false);
        if (navigator.share) {
          navigator.share({ title: 'TARIPA Safe Ride Alert', text: this.previewMessage });
          this.success.set('Ride logged! Share sheet opened.');
        } else {
          navigator.clipboard.writeText(this.previewMessage);
          this.success.set('Ride details copied to clipboard. Send to your contact!');
        }
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to log safe ride.');
        this.sending.set(false);
      },
    });
  }
}
