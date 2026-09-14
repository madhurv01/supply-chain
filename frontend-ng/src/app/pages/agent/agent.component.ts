import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { ChatMessage, ToolCall } from '../../core/models/api.models';

interface DisplayMessage extends ChatMessage {
  toolCalls?: ToolCall[];
}

@Component({
  selector: 'app-agent',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './agent.component.html',
})
export class AgentComponent {
  readonly messages = signal<DisplayMessage[]>([]);
  readonly sending = signal(false);
  draft = '';

  readonly examples = [
    "What's the optimal market to ship 200kg of tomatoes to right now?",
    'Forecast the price of wheat for the next month.',
    'Which market pays the best for onions today?',
    'Summarize my current inventory levels.',
  ];

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  constructor(private api: ApiService) {}

  useExample(example: string): void {
    this.draft = example;
    this.send();
  }

  send(): void {
    const content = this.draft.trim();
    if (!content || this.sending()) {
      return;
    }
    this.draft = '';
    this.messages.update((m) => [...m, { role: 'user', content }]);
    this.sending.set(true);

    const history = this.messages().map(({ role, content: c }) => ({ role, content: c }));

    this.api.chat(history).subscribe({
      next: (res) => {
        this.messages.update((m) => [...m, { role: 'assistant', content: res?.reply ?? '(no reply)', toolCalls: res?.toolCalls ?? [] }]);
        this.sending.set(false);
        this.scrollDown();
      },
      error: () => {
        this.messages.update((m) => [...m, { role: 'assistant', content: 'Sorry, I could not reach the agent service.' }]);
        this.sending.set(false);
        this.scrollDown();
      },
    });
  }

  private scrollDown(): void {
    setTimeout(() => {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    });
  }

  formatArgs(args: unknown): string {
    try {
      return JSON.stringify(args);
    } catch {
      return String(args);
    }
  }
}
