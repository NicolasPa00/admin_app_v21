import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast--' + t.tipo" role="status">
          <span class="toast__msg">{{ t.mensaje }}</span>
          <button type="button" class="toast__x" (click)="toast.cerrar(t.id)" aria-label="Cerrar">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: min(380px, calc(100vw - 2rem));
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 0.875rem;
      border-radius: 10px;
      border: 1px solid var(--color-border);
      border-left-width: 4px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      font-size: 0.875rem;
      animation: toast-in 0.18s ease-out;
    }
    .toast--exito { border-left-color: var(--color-success); }
    .toast--error { border-left-color: var(--color-error); }
    .toast--aviso { border-left-color: var(--color-warning); }
    .toast--info { border-left-color: var(--color-primary); }
    .toast__msg { flex: 1; line-height: 1.4; }
    .toast__x {
      border: 0;
      background: none;
      color: var(--color-text-secondary);
      font-size: 1.125rem;
      line-height: 1;
      cursor: pointer;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
}
