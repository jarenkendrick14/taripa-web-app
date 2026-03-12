import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DriverService } from '../../core/services/driver.service';
import { DriverLookupResult } from '../../core/models/taripa.models';

@Component({
  selector: 'app-pasaway',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './pasaway.component.html',
  styleUrl: './pasaway.component.css',
})
export class PasawayComponent {
  private driverService = inject(DriverService);

  searchQuery = '';
  loading     = signal(false);
  result      = signal<DriverLookupResult | null>(null);
  flagged     = signal<any[]>([]);
  error       = signal<string | null>(null);

  constructor() {
    this.loadFlagged();
  }

  lookup(): void {
    const q = this.searchQuery.trim();
    if (!q) return;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.driverService.lookupDriver(q).subscribe({
      next:  (res) => { this.result.set(res); this.loading.set(false); },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Lookup failed. Try again.');
        this.loading.set(false);
      },
    });
  }

  loadFlagged(): void {
    this.driverService.getFlaggedDrivers().subscribe({
      next: (list) => this.flagged.set(list.slice(0, 5)),
      error: () => {},
    });
  }

  selectFlagged(bodyNumber: string): void {
    this.searchQuery = bodyNumber;
    this.lookup();
  }
}
