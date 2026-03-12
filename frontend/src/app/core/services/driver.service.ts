import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DriverLookupResult } from '../models/taripa.models';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private http = inject(HttpClient);

  lookupDriver(bodyNumber: string) {
    return this.http.get<DriverLookupResult>(
      `${environment.apiUrl}/drivers/lookup/${encodeURIComponent(bodyNumber)}`
    );
  }

  getFlaggedDrivers() {
    return this.http.get<any[]>(`${environment.apiUrl}/drivers/flagged`);
  }

  searchDrivers(query: string) {
    return this.http.get<any[]>(`${environment.apiUrl}/drivers/search?q=${encodeURIComponent(query)}`);
  }
}
