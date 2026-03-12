// ─── report.service.ts ────────────────────────────────────────────
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ReportSubmission, SafeRidePayload } from '../models/taripa.models';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private http = inject(HttpClient);

  submitReport(payload: ReportSubmission) {
    return this.http.post<{ report_id: number; gps_validated: boolean; message: string }>(
      `${environment.apiUrl}/reports/submit`, payload
    );
  }

  getMyReports() {
    return this.http.get<any[]>(`${environment.apiUrl}/reports/my`);
  }

  logSafeRide(payload: SafeRidePayload) {
    return this.http.post<{ log_id: number; message: string }>(
      `${environment.apiUrl}/reports/safe-ride`, payload
    );
  }
}
