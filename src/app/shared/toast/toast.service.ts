import { Injectable, signal } from '@angular/core';

export type ToastTipo = 'exito' | 'error' | 'aviso' | 'info';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
}

/**
 * ToastService — avisos emergentes del panel.
 *
 * Toda acción que cambia algo (crear, editar, inactivar, eliminar) debe confirmar con un aviso:
 * si la fila solo desaparece de la tabla, quien la tocó no sabe si salió bien ni dónde quedó.
 * El contenedor `<app-toast-host>` vive una sola vez en el layout del admin.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private seq = 0;

  exito(mensaje: string): void {
    this.mostrar('exito', mensaje);
  }

  error(mensaje: string): void {
    this.mostrar('error', mensaje, 7000);
  }

  aviso(mensaje: string): void {
    this.mostrar('aviso', mensaje, 6000);
  }

  info(mensaje: string): void {
    this.mostrar('info', mensaje);
  }

  /** Mensaje de error legible a partir de un HttpErrorResponse (`{ message }` de Respuesta.error). */
  errorHttp(err: unknown, porDefecto = 'No se pudo completar la acción'): void {
    const e = err as { error?: { message?: string } } | null;
    this.error(e?.error?.message || porDefecto);
  }

  cerrar(id: number): void {
    this._toasts.update((l) => l.filter((t) => t.id !== id));
  }

  private mostrar(tipo: ToastTipo, mensaje: string, ms = 4500): void {
    const id = ++this.seq;
    this._toasts.update((l) => [...l.slice(-3), { id, tipo, mensaje }]);
    if (typeof window !== 'undefined') setTimeout(() => this.cerrar(id), ms);
  }
}
