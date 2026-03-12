import { Component, OnInit, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);

  /** null = follow system preference (no data-theme attribute) */
  isDark = signal<boolean | null>(null);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const saved = localStorage.getItem('taripa-theme');
    if (saved === 'dark') {
      this.isDark.set(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (saved === 'light') {
      this.isDark.set(false);
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      // No saved preference — detect system for the icon, but don't set data-theme
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDark.set(systemDark);
    }
  }

  toggleTheme() {
    if (!isPlatformBrowser(this.platformId)) return;
    const next = !this.isDark();
    this.isDark.set(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('taripa-theme', next ? 'dark' : 'light');
  }
}
