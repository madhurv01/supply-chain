import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../core/services/api.service';
import { InventoryItem } from '../../core/models/api.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, MatTableModule],
  templateUrl: './inventory.component.html',
})
export class InventoryComponent implements OnInit {
  readonly items = signal<InventoryItem[]>([]);
  readonly loading = signal(true);
  readonly columns = ['commodity', 'quantity', 'unit'];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getInventory().subscribe({
      next: (list) => {
        this.items.set(list ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }

  get totalQuantity(): number {
    return this.items().reduce((acc, i) => acc + (i.quantity ?? 0), 0);
  }

  get distinctCommodities(): number {
    return new Set(this.items().map((i) => i.commodity)).size;
  }
}
