import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { label: 'AI Agent', path: '/agent', icon: 'smart_toy' },
    { label: 'Forecast', path: '/forecast', icon: 'trending_up' },
    { label: 'Market Analysis', path: '/market', icon: 'insights' },
    { label: 'Farm', path: '/farm', icon: 'agriculture' },
    { label: 'Inventory', path: '/inventory', icon: 'inventory_2' },
    { label: 'Logistics', path: '/logistics', icon: 'local_shipping' },
    { label: 'Finance', path: '/finance', icon: 'payments' },
    { label: 'Crop Grading', path: '/grading', icon: 'photo_camera' },
  ];

  readonly darkMode = signal(false);
  readonly sidebarOpen = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  get userEmail(): string | null {
    return this.auth.email();
  }

  toggleTheme(): void {
    this.darkMode.update((v) => !v);
    document.documentElement.classList.toggle('dark', this.darkMode());
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
