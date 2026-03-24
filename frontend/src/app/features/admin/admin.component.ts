import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AdminStats, AdminReport, AdminUser, AdminTerminal, PtroReport } from '../../core/models/taripa.models';

type AdminTab = 'overview' | 'reports' | 'terminals' | 'users' | 'ptro';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);

  tab           = signal<AdminTab>('overview');
  stats         = signal<AdminStats | null>(null);
  reports       = signal<AdminReport[]>([]);
  users         = signal<AdminUser[]>([]);
  terminals     = signal<AdminTerminal[]>([]);
  ptroReports   = signal<PtroReport[]>([]);
  loading       = signal(false);
  ptroLoading   = signal(false);
  reportFilter  = signal<string>('all');

  // Terminal form
  showTerminalForm = signal(false);
  editingTerminal  = signal<AdminTerminal | null>(null);
  terminalForm = { name: '', lat: 0, lng: 0, barangay: '', radius_m: 300 };

  // User edit form
  editingUser  = signal<AdminUser | null>(null);
  userEditForm = { display_name: '', role: 'commuter' };

  ngOnInit() {
    this.loadStats();
  }

  setTab(t: AdminTab) {
    this.tab.set(t);
    if (t === 'reports'   && this.reports().length === 0)   this.loadReports();
    if (t === 'users'     && this.users().length === 0)     this.loadUsers();
    if (t === 'terminals' && this.terminals().length === 0) this.loadTerminals();
    if (t === 'ptro'      && this.ptroReports().length === 0) this.loadPtroReports();
  }

  loadStats() {
    this.loading.set(true);
    this.adminService.getStats().subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadReports() {
    this.loading.set(true);
    this.adminService.getReports(this.reportFilter()).subscribe({
      next: (r) => { this.reports.set(r.reports); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setReportFilter(f: string) {
    this.reportFilter.set(f);
    this.reports.set([]);
    this.loadReports();
  }

  updateStatus(r: AdminReport, status: string) {
    this.adminService.updateReportStatus(r.id, status).subscribe(() => {
      this.reports.update(list => list.map(x => x.id === r.id ? { ...x, status: status as any } : x));
    });
  }

  loadUsers() {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: (u) => { this.users.set(u.users); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadTerminals() {
    this.loading.set(true);
    this.adminService.getTerminals().subscribe({
      next: (t) => { this.terminals.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openNewTerminal() {
    this.editingTerminal.set(null);
    this.terminalForm = { name: '', lat: 15.1509, lng: 120.5918, barangay: '', radius_m: 300 };
    this.showTerminalForm.set(true);
  }

  openEditTerminal(t: AdminTerminal) {
    this.editingTerminal.set(t);
    this.terminalForm = { name: t.name, lat: t.lat, lng: t.lng, barangay: t.barangay || '', radius_m: t.radius_m };
    this.showTerminalForm.set(true);
  }

  saveTerminal() {
    const editing = this.editingTerminal();
    if (editing) {
      this.adminService.updateTerminal(editing.id, { ...this.terminalForm, active: true }).subscribe(() => {
        this.showTerminalForm.set(false);
        this.terminals.set([]);
        this.loadTerminals();
      });
    } else {
      this.adminService.createTerminal(this.terminalForm).subscribe(() => {
        this.showTerminalForm.set(false);
        this.terminals.set([]);
        this.loadTerminals();
      });
    }
  }

  deleteTerminal(id: number) {
    if (!confirm('Deactivate this terminal?')) return;
    this.adminService.deleteTerminal(id).subscribe(() => {
      this.terminals.update(list => list.filter(t => t.id !== id));
    });
  }

  chartPct(count: number): number {
    const days = this.stats()?.daily_reports_7d;
    if (!days?.length) return 0;
    const max = Math.max(...days.map(d => d.count), 1);
    return Math.round((count / max) * 100);
  }

  openEditUser(u: AdminUser) {
    this.editingUser.set(u);
    this.userEditForm = { display_name: u.display_name || '', role: u.role };
  }

  saveUser() {
    const u = this.editingUser();
    if (!u) return;
    this.adminService.updateUser(u.id, this.userEditForm).subscribe(() => {
      this.users.update(list => list.map(x => x.id === u.id
        ? { ...x, display_name: this.userEditForm.display_name, role: this.userEditForm.role }
        : x
      ));
      this.editingUser.set(null);
    });
  }

  deleteUser(u: AdminUser) {
    if (!confirm(`Delete user "${u.display_name || u.email}"? This cannot be undone.`)) return;
    this.adminService.deleteUser(u.id).subscribe(() => {
      this.users.update(list => list.filter(x => x.id !== u.id));
    });
  }

  loadPtroReports() {
    this.ptroLoading.set(true);
    this.adminService.getPtroReports().subscribe({
      next: (r) => { this.ptroReports.set(r); this.ptroLoading.set(false); },
      error: () => this.ptroLoading.set(false),
    });
  }

  triggerPtroReport() {
    if (!confirm('Send a PTRO report now? This will email all pending approved complaints to the PTRO.')) return;
    this.ptroLoading.set(true);
    this.adminService.triggerPtroReport().subscribe({
      next: () => { this.ptroReports.set([]); this.loadPtroReports(); },
      error: () => this.ptroLoading.set(false),
    });
  }
}
