import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminStats, AdminReport, AdminUser, AdminTerminal, PtroReport } from '../models/taripa.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin`;

  getStats() {
    return this.http.get<AdminStats>(`${this.base}/stats`);
  }

  getReports(status = 'all', page = 1, limit = 20) {
    const params = new HttpParams().set('status', status).set('page', page).set('limit', limit);
    return this.http.get<{ reports: AdminReport[]; total: number; page: number; limit: number }>(`${this.base}/reports`, { params });
  }

  updateReportStatus(id: number, status: string) {
    return this.http.patch(`${this.base}/reports/${id}/status`, { status });
  }

  getUsers(page = 1, limit = 20) {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<{ users: AdminUser[]; total: number }>(`${this.base}/users`, { params });
  }

  getTerminals() {
    return this.http.get<AdminTerminal[]>(`${this.base}/terminals`);
  }

  createTerminal(data: Partial<AdminTerminal>) {
    return this.http.post<{ id: number }>(`${this.base}/terminals`, data);
  }

  updateTerminal(id: number, data: Partial<AdminTerminal>) {
    return this.http.put(`${this.base}/terminals/${id}`, data);
  }

  deleteTerminal(id: number) {
    return this.http.delete(`${this.base}/terminals/${id}`);
  }

  updateUser(id: number, data: { display_name: string; role: string }) {
    return this.http.put(`${this.base}/users/${id}`, data);
  }

  deleteUser(id: number) {
    return this.http.delete(`${this.base}/users/${id}`);
  }

  getPtroReports() {
    return this.http.get<PtroReport[]>(`${this.base}/ptro`);
  }

  triggerPtroReport() {
    return this.http.post<{ message: string }>(`${this.base}/ptro/trigger`, {});
  }
}
