import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { GradingResult } from '../../core/models/api.models';

@Component({
  selector: 'app-grading',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './grading.component.html',
})
export class GradingComponent {
  readonly previewUrl = signal<string | null>(null);
  readonly result = signal<GradingResult | null>(null);
  readonly analyzing = signal(false);
  readonly dragging = signal(false);

  commodity = '';
  private file: File | null = null;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setFile(file);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  private setFile(file: File): void {
    this.file = file;
    this.result.set(null);
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  analyze(): void {
    if (!this.file || !this.commodity) {
      this.snackBar.open('Choose a photo and commodity first', 'Dismiss', { duration: 3000 });
      return;
    }
    this.analyzing.set(true);
    this.api.analyzeGrading(this.file, this.commodity).subscribe({
      next: (res) => {
        this.result.set(res);
        this.analyzing.set(false);
      },
      error: () => {
        this.analyzing.set(false);
        this.snackBar.open('Grading failed. Try again.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  gradeClass(grade: string | undefined): string {
    switch (grade) {
      case 'A':
        return 'text-accent-emerald';
      case 'B':
        return 'text-amber-600';
      case 'C':
        return 'text-red-600';
      default:
        return 'text-slate-400';
    }
  }
}
