// ─── fare.service.ts ──────────────────────────────────────────────
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  FareOrdinance, FareCalculationRequest, FareCalculationResult, Terminal
} from '../models/taripa.models';

@Injectable({ providedIn: 'root' })
export class FareService {
  private http = inject(HttpClient);

  getOrdinances(lgu = 'Angeles City') {
    return this.http.get<FareOrdinance[]>(`${environment.apiUrl}/fare/ordinance?lgu=${lgu}`);
  }

  calculateFare(payload: FareCalculationRequest) {
    return this.http.post<FareCalculationResult>(`${environment.apiUrl}/fare/calculate`, payload);
  }

  markResiboGenerated(calculationId: number) {
    return this.http.post(`${environment.apiUrl}/fare/resibo/${calculationId}`, {});
  }

  getTerminals() {
    return this.http.get<Terminal[]>(`${environment.apiUrl}/fare/terminals`);
  }
}
