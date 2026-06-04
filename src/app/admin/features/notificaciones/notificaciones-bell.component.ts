import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  Bell, BellOff, CheckCheck, AlertTriangle, Clock, X,
} from 'lucide-angular';
import { NotificacionService } from '../../data-access/notificacion.service';
import { Notificacion } from '../../models/notificacion.models';

@Component({
  selector: 'app-notificaciones-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Bell, BellOff, CheckCheck, AlertTriangle, Clock, X }),
    },
  ],
  template: `
    <div class="notif-wrapper" (click)="$event.stopPropagation()">
      <button
        type="button"
        class="topbar-icon-btn notif-bell"
        (click)="toggleDropdown()"
        [attr.aria-expanded]="isOpen()"
        aria-label="Notificaciones"
      >
        <lucide-icon name="bell" [size]="18" aria-hidden="true" />
        @if (notificacionService.totalNoLeidas() > 0) {
          <span class="notif-badge">{{ notificacionService.totalNoLeidas() }}</span>
        }
      </button>

      @if (isOpen()) {
        <div class="notif-dropdown" role="menu">
          <header class="notif-dropdown__header">
            <h3 class="notif-dropdown__title">Notificaciones</h3>
            @if (notificacionService.totalNoLeidas() > 0) {
              <button
                type="button"
                class="notif-dropdown__mark-all"
                (click)="marcarTodasLeidas()"
              >
                <lucide-icon name="check-check" [size]="14" aria-hidden="true" />
                Marcar todas
              </button>
            }
            <button type="button" class="notif-dropdown__close" (click)="toggleDropdown()">
              <lucide-icon name="x" [size]="16" aria-hidden="true" />
            </button>
          </header>

          <div class="notif-dropdown__body">
            @if (loading()) {
              <div class="notif-empty">
                <lucide-icon name="clock" [size]="24" aria-hidden="true" />
                <p>Cargando...</p>
              </div>
            } @else if (notificacionService.notificaciones().length === 0) {
              <div class="notif-empty">
                <lucide-icon name="bell-off" [size]="24" aria-hidden="true" />
                <p>Sin notificaciones</p>
              </div>
            } @else {
              @for (notif of notificacionService.notificaciones(); track notif.id_notificacion) {
                <button
                  type="button"
                  class="notif-item"
                  [class.notif-item--unread]="!notif.leida"
                  (click)="onItemClick(notif)"
                >
                  <div class="notif-item__icon">
                    <lucide-icon [name]="getIcon(notif.tipo)" [size]="16" aria-hidden="true" />
                  </div>
                  <div class="notif-item__content">
                    <p class="notif-item__title">{{ notif.titulo }}</p>
                    <p class="notif-item__msg">{{ notif.mensaje }}</p>
                    <span class="notif-item__time">{{ formatTime(notif.fecha_creacion) }}</span>
                  </div>
                  @if (!notif.leida) {
                    <span class="notif-item__dot" aria-label="No leída"></span>
                  }
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notif-wrapper {
      position: relative;
    }

    .notif-bell {
      position: relative;
    }

    .notif-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9999px;
      background: #ef5350;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      pointer-events: none;
    }

    .notif-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 360px;
      max-height: 480px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 300;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      @media (max-width: 480px) {
        width: calc(100vw - 32px);
        right: -60px;
      }
    }

    .notif-dropdown__header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md) var(--spacing-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .notif-dropdown__title {
      font-size: var(--font-size-base);
      font-weight: 700;
      color: var(--color-text-primary);
      margin: 0;
      flex: 1;
    }

    .notif-dropdown__mark-all {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: background var(--transition-fast);

      &:hover { background: rgba(var(--color-primary-rgb), 0.08); }
    }

    .notif-dropdown__close {
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius-sm);

      &:hover { color: var(--color-text-primary); }
    }

    .notif-dropdown__body {
      overflow-y: auto;
      max-height: 400px;
    }

    .notif-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-2xl);
      color: var(--color-text-muted);

      p { margin: 0; font-size: var(--font-size-sm); }
    }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-sm);
      width: 100%;
      padding: var(--spacing-md) var(--spacing-lg);
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--color-border);
      cursor: pointer;
      text-align: left;
      font-family: var(--font-family);
      transition: background var(--transition-fast);

      &:hover { background: var(--color-surface-hover); }
      &:last-child { border-bottom: none; }

      &--unread {
        background: rgba(var(--color-primary-rgb), 0.04);
      }
    }

    .notif-item__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: rgba(var(--color-primary-rgb), 0.1);
      color: var(--color-primary);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .notif-item__content {
      flex: 1;
      min-width: 0;
    }

    .notif-item__title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 2px;
      line-height: 1.3;
    }

    .notif-item__msg {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin: 0 0 4px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .notif-item__time {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    .notif-item__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-primary);
      flex-shrink: 0;
      margin-top: 8px;
    }
  `],
})
export class NotificacionesBellComponent implements OnInit, OnDestroy {
  readonly notificacionService = inject(NotificacionService);

  protected readonly isOpen = signal(false);
  protected readonly loading = signal(false);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargarNotificaciones();
    this.pollInterval = setInterval(() => {
      this.notificacionService.contarMisNoLeidas().subscribe();
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  protected toggleDropdown(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.cargarNotificaciones();
    }
  }

  protected cargarNotificaciones(): void {
    this.loading.set(true);
    this.notificacionService.getMisNotificaciones().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
    this.notificacionService.contarMisNoLeidas().subscribe();
  }

  protected onItemClick(notif: Notificacion): void {
    if (!notif.leida) {
      this.notificacionService.marcarLeida(notif.id_notificacion, notif.id_negocio).subscribe();
    }
  }

  protected marcarTodasLeidas(): void {
    const idsNegocio = new Set(this.notificacionService.notificaciones().map((n) => n.id_negocio));
    for (const id of idsNegocio) {
      this.notificacionService.marcarTodasLeidas(id).subscribe();
    }
  }

  protected getIcon(tipo: string): string {
    switch (tipo) {
      case 'VENCIMIENTO_PLAN': return 'alert-triangle';
      default: return 'bell';
    }
  }

  protected formatTime(fecha: string): string {
    const d = new Date(fecha);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }
}
