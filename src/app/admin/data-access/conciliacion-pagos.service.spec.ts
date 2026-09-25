import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../auth/data-access/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { CobranzaService } from './cobranza.service';
import { ConciliacionPagosService } from './conciliacion-pagos.service';

/**
 * La conciliación de pagos se dispara cuando el usuario ENTRA (sesión autenticada) y cuando VUELVE
 * a la pestaña (con debounce), refresca la sesión si se confirmó un pago y nunca estorba.
 */
describe('ConciliacionPagosService', () => {
  const autenticado = signal(false);
  const suplantando = signal(false);
  let api: { conciliarPendientes: ReturnType<typeof vi.fn> };
  let auth: { isAuthenticated: () => boolean; isImpersonating: () => boolean; refrescarSesion: ReturnType<typeof vi.fn> };
  let toast: { exito: ReturnType<typeof vi.fn> };
  let servicio: ConciliacionPagosService;
  let visibilidad: 'visible' | 'hidden';

  function crear(): ConciliacionPagosService {
    return TestBed.inject(ConciliacionPagosService);
  }

  /** Simula el cambio de pestaña. */
  function cambiarPestana(estado: 'visible' | 'hidden'): void {
    visibilidad = estado;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    autenticado.set(false);
    suplantando.set(false);
    visibilidad = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidad });

    api = { conciliarPendientes: vi.fn(() => of({ aplicados: [], pendientes: 0 })) };
    auth = {
      isAuthenticated: () => autenticado(),
      isImpersonating: () => suplantando(),
      refrescarSesion: vi.fn(() =>
        of({ negocios: [{ id_negocio: 13, plan: { fecha_fin: '2026-10-23T23:59:59' } }] } as never),
      ),
    };
    toast = { exito: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: CobranzaService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: DOCUMENT, useValue: document },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin sesión no consulta nada', () => {
    servicio = crear();
    TestBed.tick();
    expect(api.conciliarPendientes).not.toHaveBeenCalled();
  });

  it('al iniciar sesión (la sesión pasa a autenticada) consulta con origen al_iniciar_sesion', () => {
    servicio = crear();
    autenticado.set(true);
    TestBed.tick();

    expect(api.conciliarPendientes).toHaveBeenCalledTimes(1);
    expect(api.conciliarPendientes).toHaveBeenCalledWith('al_iniciar_sesion');
  });

  it('al abrir la app con la sesión ya restaurada también consulta', () => {
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();

    expect(api.conciliarPendientes).toHaveBeenCalledWith('al_iniciar_sesion');
  });

  it('al volver a la pestaña consulta UNA vez, con debounce, aunque haya varios eventos', () => {
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();
    api.conciliarPendientes.mockClear();
    vi.advanceTimersByTime(ConciliacionPagosService.INTERVALO_MIN_MS + 1);

    cambiarPestana('visible');
    cambiarPestana('visible');
    cambiarPestana('visible');
    expect(api.conciliarPendientes).not.toHaveBeenCalled(); // todavía en el debounce

    vi.advanceTimersByTime(ConciliacionPagosService.DEBOUNCE_MS + 1);
    expect(api.conciliarPendientes).toHaveBeenCalledTimes(1);
    expect(api.conciliarPendientes).toHaveBeenCalledWith('al_volver');
  });

  it('al ocultar la pestaña no consulta', () => {
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();
    api.conciliarPendientes.mockClear();
    vi.advanceTimersByTime(ConciliacionPagosService.INTERVALO_MIN_MS + 1);

    cambiarPestana('hidden');
    vi.advanceTimersByTime(ConciliacionPagosService.DEBOUNCE_MS + 1);
    expect(api.conciliarPendientes).not.toHaveBeenCalled();
  });

  it('volver a la pestaña justo después de consultar no vuelve a consultar', () => {
    autenticado.set(true);
    servicio = crear();
    TestBed.tick(); // consultó al iniciar
    api.conciliarPendientes.mockClear();

    cambiarPestana('visible');
    vi.advanceTimersByTime(ConciliacionPagosService.DEBOUNCE_MS + 1);
    expect(api.conciliarPendientes).not.toHaveBeenCalled();
  });

  it('no consulta durante una impersonación', () => {
    suplantando.set(true);
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();
    expect(api.conciliarPendientes).not.toHaveBeenCalled();
  });

  it('si se confirmó un pago: refresca la sesión y avisa con la fecha del plan', () => {
    api.conciliarPendientes.mockReturnValue(
      of({ aplicados: [{ id_negocio: 13, referencia: 'EA-13-202609' }], pendientes: 0 }),
    );
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();

    expect(auth.refrescarSesion).toHaveBeenCalledTimes(1);
    expect(toast.exito).toHaveBeenCalledTimes(1);
    expect(toast.exito.mock.calls[0][0]).toMatch(/Confirmamos tu pago: tu plan está activo hasta el .*2026/);
    expect(servicio.pagosConfirmados()).toBe(1);
  });

  it('sin pagos confirmados no refresca ni avisa', () => {
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();

    expect(auth.refrescarSesion).not.toHaveBeenCalled();
    expect(toast.exito).not.toHaveBeenCalled();
  });

  it('si el perfil no se puede recargar, el aviso sale igual (sin fecha)', () => {
    api.conciliarPendientes.mockReturnValue(
      of({ aplicados: [{ id_negocio: 13, referencia: 'x' }], pendientes: 0 }),
    );
    auth.refrescarSesion.mockReturnValue(throwError(() => new Error('perfil')));
    autenticado.set(true);
    servicio = crear();
    TestBed.tick();

    expect(toast.exito).toHaveBeenCalledWith('Confirmamos tu pago: tu plan ya está activo.');
  });

  it('un error de red es silencioso: no lanza ni muestra nada', () => {
    api.conciliarPendientes.mockReturnValue(throwError(() => new Error('502')));
    autenticado.set(true);
    servicio = crear();

    expect(() => TestBed.tick()).not.toThrow();
    expect(toast.exito).not.toHaveBeenCalled();
  });
});
