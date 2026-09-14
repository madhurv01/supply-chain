import { Component, ElementRef, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const WIDTH_KEY = 'agrichain.sidebar.width';
const MIN_WIDTH = 200;
const MAX_WIDTH = 380;
const DEFAULT_WIDTH = 256;

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

  readonly tickerMessages: string[] = [
    '🌾 Market price intelligence across every major mandi',
    '🚚 Live shipment tracking across India',
    '🤖 AI-powered routing & crop grading',
    '📈 Real-time market analysis & forecasting',
    '🌱 Farm-to-warehouse supply chain visibility',
  ];

  readonly sidebarOpen = signal(false);
  readonly sidebarWidth = signal(this.readStoredWidth());
  readonly resizing = signal(false);

  constructor(private auth: AuthService, private router: Router, private hostEl: ElementRef<HTMLElement>) {}

  get userEmail(): string | null {
    return this.auth.email();
  }

  get userInitial(): string {
    const email = this.userEmail;
    return email ? email.charAt(0).toUpperCase() : 'U';
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private readStoredWidth(): number {
    try {
      const stored = localStorage.getItem(WIDTH_KEY);
      const parsed = stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
      if (Number.isFinite(parsed)) {
        return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_WIDTH;
  }

  onResizeStart(event: PointerEvent): void {
    event.preventDefault();
    this.resizing.set(true);
    const startX = event.clientX;
    const startWidth = this.sidebarWidth();

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      this.sidebarWidth.set(next);
    };

    const onUp = () => {
      this.resizing.set(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try {
        localStorage.setItem(WIDTH_KEY, String(this.sidebarWidth()));
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
}
