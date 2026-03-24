import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    title: 'TARIPA — Know the Fare',
  },
  {
    path: 'resibo',
    loadComponent: () => import('./features/resibo/resibo.component').then(m => m.ResiboComponent),
    title: 'Resibo — Fare Calculator',
  },
  {
    path: 'pasaway',
    loadComponent: () => import('./features/pasaway/pasaway.component').then(m => m.PasawayComponent),
    title: 'Pasaway — Driver Lookup',
  },
  {
    path: 'bantay-batas',
    loadComponent: () => import('./features/bantay-batas/bantay-batas.component').then(m => m.BantayBatasComponent),
    title: 'Bantay Batas — Community Alerts',
  },
  {
    path: 'report',
    loadComponent: () => import('./features/report/report.component').then(m => m.ReportComponent),
    canActivate: [authGuard],
    title: 'Submit Report — TARIPA',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    title: 'Login — TARIPA',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
    title: 'Register — TARIPA',
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'Profile — TARIPA',
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [adminGuard],
    title: 'Admin Dashboard — TARIPA',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
