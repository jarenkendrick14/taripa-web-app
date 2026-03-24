import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ResiboHistory } from '../../core/models/taripa.models';

type ProfileTab = 'info' | 'history' | 'reports';

interface MyReport {
  id: number;
  body_number: string;
  reported_fare: number;
  calculated_fare: number;
  overcharge_amount: number;
  origin_name: string;
  destination_name: string;
  distance_km: number;
  status: string;
  reported_at: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  auth    = inject(AuthService);
  private http = inject(HttpClient);

  tab       = signal<ProfileTab>('info');
  history   = signal<ResiboHistory[]>([]);
  reports   = signal<MyReport[]>([]);
  loading   = signal(false);
  historyLoaded = false;
  reportsLoaded = false;

  ngOnInit() {
    this.loadHistory();
    this.loadReports();
  }

  setTab(t: ProfileTab) {
    this.tab.set(t);
  }

  loadHistory() {
    if (this.historyLoaded) return;
    this.loading.set(true);
    this.http.get<ResiboHistory[]>(`${environment.apiUrl}/fare/my-history`).subscribe({
      next: (data) => { this.history.set(data); this.historyLoaded = true; this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadReports() {
    if (this.reportsLoaded) return;
    this.http.get<MyReport[]>(`${environment.apiUrl}/reports/my`).subscribe({
      next: (data) => { this.reports.set(data); this.reportsLoaded = true; },
      error: () => {},
    });
  }

  logout() {
    this.auth.logout();
  }
}
