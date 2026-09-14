import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatTabsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly tab = signal(0);
  readonly loading = signal(false);

  email = '';
  password = '';

  constructor(private auth: AuthService, private router: Router, private snackBar: MatSnackBar) {}

  submit(): void {
    if (!this.email || !this.password) {
      this.snackBar.open('Enter email and password', 'Dismiss', { duration: 3000 });
      return;
    }
    this.loading.set(true);
    const call = this.tab() === 0 ? this.auth.login(this.email, this.password) : this.auth.register(this.email, this.password);
    call.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.message ?? err?.message ?? 'Authentication failed';
        this.snackBar.open(message, 'Dismiss', { duration: 4000 });
      },
    });
  }
}
