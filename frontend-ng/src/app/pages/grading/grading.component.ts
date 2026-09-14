import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { GradingResult } from '../../core/models/api.models';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const PROVIDER_ERROR_PATTERNS = [
  'blocked at the organization',
  'provider returned an error',
  'model_permission_blocked_org',
];

@Component({
  selector: 'app-grading',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './grading.component.html',
})
export class GradingComponent implements OnInit {
  readonly commodities = signal<string[]>([]);
  readonly previewUrl = signal<string | null>(null);
  readonly result = signal<GradingResult | null>(null);
  readonly analyzing = signal(false);
  readonly dragging = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly providerError = signal<string | null>(null);
  readonly genericError = signal<string | null>(null);

  commodity = '';
  fileName = '';
  private file: File | null = null;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.getCommodities().subscribe({
      next: (list) => this.commodities.set(list ?? []),
      error: () => this.commodities.set([]),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setFile(file);
    }
    input.value = '';
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
    this.fileError.set(null);
    this.providerError.set(null);
    this.genericError.set(null);
    this.result.set(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.fileError.set('Unsupported file type. Please upload a JPG, PNG or WEBP image.');
      this.file = null;
      this.previewUrl.set(null);
      this.fileName = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is 8MB.`);
      this.file = null;
      this.previewUrl.set(null);
      this.fileName = '';
      return;
    }

    this.file = file;
    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  analyze(): void {
    if (!this.file) {
      this.snackBar.open('Choose a crop photo first', 'Dismiss', { duration: 3000 });
      return;
    }
    if (!this.commodity) {
      this.snackBar.open('Select a commodity first', 'Dismiss', { duration: 3000 });
      return;
    }
    this.result.set(null);
    this.providerError.set(null);
    this.genericError.set(null);
    this.analyzing.set(true);
    this.api.analyzeGrading(this.file, this.commodity).subscribe({
      next: (res: any) => {
        this.analyzing.set(false);
        if (res && res.success === false) {
          this.handleFailure(res.message as string | undefined);
          return;
        }
        this.result.set(res as GradingResult);
      },
      error: (err) => {
        this.analyzing.set(false);
        const message = err?.error?.message as string | undefined;
        this.handleFailure(message);
      },
    });
  }

  private handleFailure(message: string | undefined): void {
    const text = message ?? '';
    const isProviderIssue = PROVIDER_ERROR_PATTERNS.some((p) => text.toLowerCase().includes(p.toLowerCase()));
    if (isProviderIssue) {
      this.providerError.set(text);
    } else if (text) {
      this.genericError.set(text);
    } else {
      this.genericError.set('Grading failed. Please try again.');
    }
  }

  clearFile(): void {
    this.file = null;
    this.fileName = '';
    this.previewUrl.set(null);
    this.result.set(null);
    this.fileError.set(null);
    this.providerError.set(null);
    this.genericError.set(null);
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
