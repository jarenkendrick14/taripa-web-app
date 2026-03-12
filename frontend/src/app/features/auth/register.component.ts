import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './auth.component.css',
})
export class RegisterComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  displayName = '';
  email       = '';
  password    = '';
  loading     = signal(false);
  error       = signal<string | null>(null);

  register(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.register(this.email, this.password, this.displayName).subscribe({
      next:  () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Registration failed. Try again.');
        this.loading.set(false);
      },
    });
  }
}
