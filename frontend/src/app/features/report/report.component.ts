import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ReportService } from '../../core/services/report.service';
import { GeolocationService } from '../../core/services/geolocation.service';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './report.component.html',
  styleUrl: './report.component.css',
})
export class ReportComponent {
  private reportService = inject(ReportService);
  private geoService    = inject(GeolocationService);

  bodyNumber     = '';
  reportedFare   = 0;
  calculatedFare = 0;
  originName     = '';
  destName       = '';
  passengerCount = 1;
  description    = '';

  submitting   = signal(false);
  submitted    = signal(false);
  gpsValidated = signal(false);
  error        = signal<string | null>(null);

  get overchargeAmount(): number {
    const diff = this.reportedFare - this.calculatedFare;
    return diff > 0 ? diff : 0;
  }

  get canSubmit(): boolean {
    return !!this.bodyNumber.trim()
      && this.reportedFare > 0
      && this.calculatedFare > 0
      && this.reportedFare > this.calculatedFare;
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting.set(true);
    this.error.set(null);

    const pos = this.geoService.currentPosition();

    this.reportService.submitReport({
      body_number:      this.bodyNumber.trim().toUpperCase(),
      reported_fare:    this.reportedFare,
      calculated_fare:  this.calculatedFare,
      origin_name:      this.originName   || undefined,
      destination_name: this.destName     || undefined,
      passenger_count:  this.passengerCount,
      description:      this.description  || undefined,
      user_current_lat: pos?.lat,
      user_current_lng: pos?.lng,
    }).subscribe({
      next: (res) => {
        this.gpsValidated.set(res.gps_validated);
        this.submitted.set(true);
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
