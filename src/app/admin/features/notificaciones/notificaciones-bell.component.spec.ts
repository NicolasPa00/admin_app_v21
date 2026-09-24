import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';

import { NotificacionService } from '../../data-access/notificacion.service';
import { ConversacionEsperando } from '../../models/notificacion.models';
import { NotificacionesBellComponent } from './notificaciones-bell.component';

const espera = (id: string, negocio: number, over: Partial<ConversacionEsperando> = {}): ConversacionEsperando => ({
  id_conversacion: id,
  id_negocio: negocio,
  negocio: `Negocio ${negocio}`,
  persona: null,
  telefono_e164: '+573001112233',
  id_externo: '573001112233',
  ultimo_mensaje_en: new Date().toISOString(),
  ultimo_texto: 'Necesito hablar con alguien',
  ...over,
});

async function montar(esperando: ConversacionEsperando[], total = esperando.length, noLeidas = 0) {
  const { signal } = await import('@angular/core');
  const servicio = {
    notificaciones: signal([]),
    totalNoLeidas: signal(noLeidas),
    esperando: signal(esperando),
    totalEsperando: signal(total),
    getMisNotificaciones: () => of([]),
    contarMisNoLeidas: () => of(noLeidas),
    getEsperandoRespuesta: () => of(esperando),
    marcarLeida: () => of({ success: true }),
    marcarTodasLeidas: () => of({ success: true }),
  };
  TestBed.configureTestingModule({
    imports: [NotificacionesBellComponent],
    providers: [provideRouter([]), { provide: NotificacionService, useValue: servicio }],
  });
  const fixture = TestBed.createComponent(NotificacionesBellComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const abrir = () => {
    (el.querySelector('.notif-bell') as HTMLElement).click();
    fixture.detectChanges();
  };
  return { fixture, el, abrir };
}

describe('Campana — conversaciones que esperan respuesta', () => {
  it('el contador suma lo que espera respuesta a las notificaciones sin leer', async () => {
    const v = await montar([espera('a', 1), espera('b', 2)], 2, 3);
    const badge = v.el.querySelector('.notif-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('5');
    expect(badge.classList.contains('notif-badge--espera')).toBe(true);
  });

  it('sin nada pendiente no hay contador', async () => {
    const v = await montar([], 0, 0);
    expect(v.el.querySelector('.notif-badge')).toBeFalsy();
  });

  it('lista las que esperan, con nombre o número, y cada una lleva a WhatsApp con SU negocio', async () => {
    const v = await montar([
      espera('a', 7, { persona: 'Ana Prueba' }),
      espera('b', 9, { persona: null, telefono_e164: '+573104445566' }),
    ]);
    v.abrir();
    const items = Array.from(v.el.querySelectorAll('.notif-item--espera'));
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.notif-item__title')?.textContent?.trim()).toBe('Ana Prueba');
    expect(items[1].querySelector('.notif-item__title')?.textContent?.trim()).toBe('+573104445566');

    const router = TestBed.inject(Router);
    const ir = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (items[1] as HTMLElement).click();
    expect(ir).toHaveBeenCalledWith(['/admin/whatsapp'], { queryParams: { negocio: 9 } });
  });

  it('si hay más de las que caben, ofrece verlas todas en Conversaciones', async () => {
    const v = await montar([espera('a', 1)], 12);
    v.abrir();
    expect(v.el.querySelector('.notif-mas')?.textContent).toContain('12');
  });

  it('sin nada esperando ni notificaciones muestra el estado vacío', async () => {
    const v = await montar([], 0, 0);
    v.abrir();
    expect(v.el.textContent).toContain('Sin notificaciones');
    expect(v.el.querySelector('.notif-item--espera')).toBeFalsy();
  });
});
