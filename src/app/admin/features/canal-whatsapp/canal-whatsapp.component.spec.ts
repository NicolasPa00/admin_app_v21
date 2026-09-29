import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { Negocio } from '../../models/admin.models';
import { CanalWhatsappComponent } from './canal-whatsapp.component';

/**
 * Los dos arreglos del 2026-09-28, con el primer cliente real delante:
 *   - iPhone: `FB.login()` sale del mismo clic, sin esperar a nada (si no, Safari bloquea la ventana).
 *   - Coexistencia: «Ya uso WhatsApp Business» abre el camino que conserva la app del celular.
 */

type Login = (cb: (r: { authResponse?: { code?: string } | null }) => void, op: Record<string, unknown>) => void;

const negocio = { id_negocio: 1, nombre: 'Prueba Barbería', estado: 'A' } as Negocio;

function mensajeMeta(event: string, data: Record<string, unknown> = {}, origin = 'https://www.facebook.com') {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin,
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event, data }),
    }),
  );
}

async function montar({ login, canjear }: { login: Login; canjear?: ReturnType<typeof vi.fn> }) {
  window.FB = { init: vi.fn(), login: vi.fn(login) };
  const canjearFn = canjear ?? vi.fn(() => of({ idExterno: 'P1', numeroE164: null, wabaId: 'W', coexistencia: true, sincronizacion: null }));
  TestBed.configureTestingModule({
    imports: [CanalWhatsappComponent],
    providers: [
      provideRouter([]),
      { provide: AdminService, useValue: { getMisNegociosUsuario: () => of([negocio]) } },
      {
        provide: CanalWhatsappService,
        useValue: { getEstado: () => of({ conectado: false }), canjear: canjearFn, desconectar: () => of(null) },
      },
    ],
  });
  const fixture = TestBed.createComponent(CanalWhatsappComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
  return { fixture, el, boton, canjear: canjearFn, comp: fixture.componentInstance };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('CanalWhatsappComponent — conectar el número propio', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => {
    delete window.FB;
  });

  it('muestra los dos caminos y con el SDK listo están habilitados', async () => {
    const v = await montar({ login: () => {} });
    expect(v.boton('Ya uso WhatsApp Business').disabled).toBe(false);
    expect(v.boton('Usar un número nuevo').disabled).toBe(false);
  });

  it('iPhone: FB.login() se llama DENTRO del clic, sin esperas (Safari bloquea la ventana si no)', async () => {
    const v = await montar({ login: () => {} });
    v.boton('Ya uso WhatsApp Business').click();
    // Sin await entre el clic y esta línea: si hubiera un await antes de FB.login, esto fallaría.
    expect(window.FB!.login).toHaveBeenCalledTimes(1);
  });

  it('«Ya uso WhatsApp Business» abre la coexistencia (featureType whatsapp_business_app_onboarding)', async () => {
    const v = await montar({ login: () => {} });
    v.boton('Ya uso WhatsApp Business').click();
    const opciones = (window.FB!.login as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opciones).toMatchObject({
      config_id: expect.any(String),
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, sessionInfoVersion: '3', featureType: 'whatsapp_business_app_onboarding' },
    });
  });

  it('«Usar un número nuevo» abre el camino estándar, sin featureType', async () => {
    const v = await montar({ login: () => {} });
    v.boton('Usar un número nuevo').click();
    const opciones = (window.FB!.login as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      extras: Record<string, unknown>;
    };
    expect(opciones.extras['featureType']).toBeUndefined();
  });

  it('coexistencia: canjea con el evento FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING (aunque no traiga número)', async () => {
    const v = await montar({
      login: (cb) => {
        mensajeMeta('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', { waba_id: 'W1', business_id: 'B1' });
        cb({ authResponse: { code: 'CODE-1' } });
      },
    });
    v.boton('Ya uso WhatsApp Business').click();
    await esperar(200);
    expect(v.canjear).toHaveBeenCalledWith(1, {
      code: 'CODE-1',
      modo: 'coexistencia',
      phoneNumberId: null,
      numeroE164: null,
      businessId: 'B1',
    });
  });

  it('acepta el evento desde m.facebook.com (móvil), no solo www', async () => {
    const v = await montar({
      login: (cb) => {
        mensajeMeta('FINISH', { phone_number_id: 'PN-9', business_id: 'B9' }, 'https://m.facebook.com');
        cb({ authResponse: { code: 'CODE-9' } });
      },
    });
    v.boton('Usar un número nuevo').click();
    await esperar(200);
    expect(v.canjear).toHaveBeenCalledWith(1, expect.objectContaining({ phoneNumberId: 'PN-9', modo: 'nuevo' }));
  });

  it('ignora mensajes de orígenes que no son de Facebook', async () => {
    const v = await montar({
      login: (cb) => {
        mensajeMeta('FINISH', { phone_number_id: 'FALSO' }, 'https://facebook.com.evil.test');
        mensajeMeta('FINISH', { phone_number_id: 'PN-OK' });
        cb({ authResponse: { code: 'C' } });
      },
    });
    v.boton('Usar un número nuevo').click();
    await esperar(200);
    expect(v.canjear).toHaveBeenCalledWith(1, expect.objectContaining({ phoneNumberId: 'PN-OK' }));
  });

  it('si el evento no llega, canjea igual tras esperar un poco (el backend resuelve el número)', async () => {
    const v = await montar({ login: (cb) => cb({ authResponse: { code: 'C2' } }) });
    v.boton('Ya uso WhatsApp Business').click();
    await esperar(2900);
    expect(v.canjear).toHaveBeenCalledWith(1, expect.objectContaining({ code: 'C2', phoneNumberId: null }));
  });

  it('ventana cerrada sin terminar: mensaje claro y los botones vuelven', async () => {
    const v = await montar({ login: (cb) => cb({ authResponse: null }) });
    v.boton('Ya uso WhatsApp Business').click();
    await esperar(20);
    v.fixture.detectChanges();
    expect(v.el.textContent).toContain('Se cerró la ventana de Facebook');
    expect(v.canjear).not.toHaveBeenCalled();
    expect(v.boton('Ya uso WhatsApp Business').disabled).toBe(false);
  });

  it('CANCEL con error de Meta: se enseña el mensaje de Meta', async () => {
    const v = await montar({
      login: (cb) => {
        mensajeMeta('CANCEL', { error_message: 'Número no válido', error_id: '1' });
        cb({ authResponse: null });
      },
    });
    v.boton('Usar un número nuevo').click();
    await esperar(20);
    v.fixture.detectChanges();
    expect(v.el.textContent).toContain('Número no válido');
  });

  it('ventana bloqueada (FB.login nunca responde): «Cancelar» libera la pantalla', async () => {
    const v = await montar({ login: () => {} });
    v.boton('Ya uso WhatsApp Business').click();
    v.fixture.detectChanges();
    expect(v.el.textContent).toContain('permite las ventanas emergentes');
    v.boton('Cancelar').click();
    v.fixture.detectChanges();
    expect(v.boton('Ya uso WhatsApp Business').disabled).toBe(false);
  });

  it('un error del backend al canjear se muestra tal cual', async () => {
    const canjear = vi.fn(() =>
      throwError(() => ({ error: { message: 'Este número de WhatsApp ya está conectado a otro negocio de EscalApp.' } })),
    );
    const v = await montar({
      login: (cb) => {
        mensajeMeta('FINISH', { phone_number_id: 'P' });
        cb({ authResponse: { code: 'C' } });
      },
      canjear,
    });
    v.boton('Usar un número nuevo').click();
    await esperar(200);
    v.fixture.detectChanges();
    expect(v.el.textContent).toContain('ya está conectado a otro negocio');
  });
});
