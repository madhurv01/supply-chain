import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'agent', loadComponent: () => import('./pages/agent/agent.component').then((m) => m.AgentComponent) },
      { path: 'forecast', loadComponent: () => import('./pages/forecast/forecast.component').then((m) => m.ForecastComponent) },
      { path: 'market', loadComponent: () => import('./pages/market/market.component').then((m) => m.MarketComponent) },
      { path: 'farm', loadComponent: () => import('./pages/farm/farm.component').then((m) => m.FarmComponent) },
      { path: 'inventory', loadComponent: () => import('./pages/inventory/inventory.component').then((m) => m.InventoryComponent) },
      { path: 'logistics', loadComponent: () => import('./pages/logistics/logistics.component').then((m) => m.LogisticsComponent) },
      { path: 'finance', loadComponent: () => import('./pages/finance/finance.component').then((m) => m.FinanceComponent) },
      { path: 'grading', loadComponent: () => import('./pages/grading/grading.component').then((m) => m.GradingComponent) },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
