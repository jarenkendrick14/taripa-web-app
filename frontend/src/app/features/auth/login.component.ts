import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.component.css',
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal<string | null>(null);

  login(): void {
    if (!this.email || !this.password) {
      this.error.set('Please enter both your email/username and password.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next:  () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Login failed. Check your credentials.');
        this.loading.set(false);
      },
    });
  }
}
