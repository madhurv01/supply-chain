import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { FarmPlot } from '../../core/models/api.models';

@Component({
  selector: 'app-farm',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './farm.component.html',
})
export class FarmComponent implements OnInit {
  readonly plots = signal<FarmPlot[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);

  commodity = '';
  plotId = '';
  quantity: number | null = null;
  datePlanted: Date | null = null;
  expectedHarvestDate: Date | null = null;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadPlots();
  }

  loadPlots(): void {
    this.loading.set(true);
    this.api.getPlots('GROWING').subscribe({
      next: (list) => {
        this.plots.set(list ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.plots.set([]);
        this.loading.set(false);
      },
    });
  }

  addPlot(): void {
    if (!this.commodity || !this.plotId || !this.quantity || !this.datePlanted || !this.expectedHarvestDate) {
      this.snackBar.open('Fill all fields', 'Dismiss', { duration: 3000 });
      return;
    }
    this.submitting.set(true);
    this.api
      .addPlot({
        commodity: this.commodity,
        plotId: this.plotId,
        quantity: this.quantity,
        datePlanted: this.datePlanted.toISOString(),
        expectedHarvestDate: this.expectedHarvestDate.toISOString(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.commodity = '';
          this.plotId = '';
          this.quantity = null;
          this.datePlanted = null;
          this.expectedHarvestDate = null;
          this.loadPlots();
          this.snackBar.open('Plot added', 'Dismiss', { duration: 2500 });
        },
        error: () => {
          this.submitting.set(false);
          this.snackBar.open('Failed to add plot', 'Dismiss', { duration: 3000 });
        },
      });
  }

  harvest(plot: FarmPlot): void {
    if (plot.id === undefined) {
      return;
    }
    this.api.harvest({ plotRowId: plot.id, commodity: plot.commodity, quantity: plot.quantityPlanted }).subscribe({
      next: () => {
        this.snackBar.open('Harvested', 'Dismiss', { duration: 2500 });
        this.loadPlots();
      },
      error: () => this.snackBar.open('Failed to harvest', 'Dismiss', { duration: 3000 }),
    });
  }
}
