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
  emailError  = signal<string | null>(null);

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  onEmailInput(): void {
    if (this.emailError()) this.emailError.set(null);
  }

  validateEmail(): void {
    const email = this.email.trim();
    if (!email) {
      this.emailError.set('Email is required.');
      return;
    }
    if (!this.isValidEmail(email)) {
      this.emailError.set('Enter a valid email address.');
      return;
    }
    this.emailError.set(null);
  }

  register(): void {
    const email = this.email.trim();
    this.email = email;
    this.error.set(null);
    if (!email) {
      this.emailError.set('Email is required.');
      return;
    }
    if (!this.isValidEmail(email)) {
      this.emailError.set('Enter a valid email address.');
      return;
    }
    this.emailError.set(null);
    if (!this.password) {
      this.error.set('Password is required.');
      return;
    }
    this.loading.set(true);
    this.auth.register(this.email, this.password, this.displayName).subscribe({
      next:  () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Registration failed. Try again.');
        this.loading.set(false);
      },
    });
  }
}
