import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { describe, it, expect } from 'vitest';

import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { BandejaService } from '../../data-access/bandeja.service';
import { Negocio } from '../../models/admin.models';
import { WhatsappComponent } from './whatsapp.component';
import { CanalWhatsappComponent } from '../canal-whatsapp/canal-whatsapp.component';

const negocio = (id: number, nombre: string, features?: string[]): Negocio =>
  ({ id_negocio: id, nombre, estado: 'A', features }) as Negocio;

async function montar<T>(comp: new () => T, negocios: Negocio[], conectado = false) {
  TestBed.configureTestingModule({
    imports: [comp],
    providers: [
      provideRouter([]),
      { provide: AdminService, useValue: { getMisNegociosUsuario: () => of(negocios).pipe(delay(5)) } },
      {
        // La bandeja pide su lista al montarse; con un negocio conectado se renderiza de verdad.
        provide: BandejaService,
        useValue: {
          getConversaciones: () =>
            of({
              disponible: true,
              negocios: [{ id_negocio: 1, nombre: 'Prueba Barbería' }],
              conversaciones: [
                {
                  id_conversacion: 'c1',
                  id_negocio: 1,
                  estado: 'activa',
                  canal: 'whatsapp',
                  id_externo: '573001112233',
                  creado_en: '2026-09-23T10:00:00',
                  ultimo_mensaje_en: '2026-09-23T10:05:00',
                  negocio: 'Prueba Barbería',
                  persona: 'Ana Prueba',
                  telefono_e164: '+573001112233',
                  escalada: false,
                  ultimo_texto: 'Hola, quiero una cita',
                  reportes: 0,
                },
              ],
            }).pipe(delay(5)),
          getConversacion: () => of(null),
        },
      },
      {
        provide: CanalWhatsappService,
        useValue: { getEstado: () => of({ conectado }).pipe(delay(5)), desconectar: () => of(null) },
      },
    ],
  });
  const fixture = TestBed.createComponent(comp);
  fixture.detectChanges();
  // Respuestas asíncronas como las de HTTP: el estado pasa de «cargando» a «listo» por etapas.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 20));
    fixture.detectChanges();
  }
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const esperar = async () => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 20));
      fixture.detectChanges();
    }
  };
  return {
    el,
    fixture,
    esperar,
    titulos: () => Array.from(el.querySelectorAll('h1')).map((h) => h.textContent?.trim()),
    cabeceras: () => el.querySelectorAll('.cw__head').length,
  };
}

describe('WhatsappComponent — un solo título por pantalla', () => {
  const habilitados = [
    negocio(1, 'Prueba Barbería', ['asistente_ia']),
    negocio(2, 'Prueba Restaurante', ['asistente_ia']),
    negocio(3, 'Prueba Tienda', ['asistente_ia']),
  ];

  it('vista de conexión (varios negocios, ninguno conectado): exactamente un «Conectar WhatsApp»', async () => {
    const v = await montar(WhatsappComponent, habilitados);
    expect(v.titulos()).toEqual(['Conectar WhatsApp']);
    expect(v.cabeceras()).toBe(0);
    expect(v.el.querySelectorAll('[role="tab"]').length).toBe(3);
  });

  it('al cambiar de negocio con un chip sigue habiendo un solo título', async () => {
    const v = await montar(WhatsappComponent, habilitados);
    (v.el.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await v.esperar();
    expect(v.titulos()).toEqual(['Conectar WhatsApp']);
    expect(v.cabeceras()).toBe(0);
    (v.el.querySelectorAll('[role="tab"]')[2] as HTMLElement).click();
    await v.esperar();
    expect(v.titulos()).toEqual(['Conectar WhatsApp']);
  });

  it('vista de conexión con un solo negocio: un título y sin chips', async () => {
    const v = await montar(WhatsappComponent, [habilitados[0]]);
    expect(v.titulos()).toEqual(['Conectar WhatsApp']);
    expect(v.el.querySelectorAll('[role="tab"]').length).toBe(0);
  });

  it('sin negocios: un solo título', async () => {
    const v = await montar(WhatsappComponent, []);
    expect(v.titulos()).toEqual(['Conectar WhatsApp']);
  });

  it('sin la feature (mejora de plan): un solo título', async () => {
    const v = await montar(WhatsappComponent, [
      negocio(1, 'Prueba Barbería', ['otra']),
      negocio(2, 'Prueba Tienda', ['otra']),
    ]);
    expect(v.titulos()).toEqual(['WhatsApp']);
    expect(v.el.querySelector('.wa__mejora')).toBeTruthy();
  });
});

describe('WhatsappComponent con negocio conectado (bandeja)', () => {
  // Regresión de producción: «Tu número» lleva un <lucide-icon name="smartphone"> declarado en
  // WhatsappComponent y PROYECTADO dentro de <app-bandeja>. Cuando la bandeja registraba sus
  // íconos en `providers` (y no en `viewProviders`), el ícono proyectado se resolvía contra los de
  // la bandeja, no lo encontraba («The "smartphone" icon has not been provided…») y el error
  // cortaba el render: bandeja vacía y sin íconos.
  it('renderiza «Tu número» con su ícono y la lista de la bandeja, sin errores', async () => {
    const errores: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errores.push(args);
    };
    try {
      const v = await montar(
        WhatsappComponent,
        [negocio(1, 'Prueba Barbería', ['asistente_ia'])],
        true,
      );

      // La lista de la bandeja llegó a pintarse.
      expect(v.el.querySelector('app-bandeja')).toBeTruthy();
      expect(v.el.textContent).toContain('Hola, quiero una cita');

      // El botón proyectado existe y su ícono se dibujó (svg dentro de lucide-icon).
      const boton = Array.from(v.el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Tu número'),
      );
      expect(boton).toBeTruthy();
      expect(boton!.querySelector('lucide-icon svg')).toBeTruthy();

      // Y los íconos propios de la bandeja siguen resolviéndose (la marca y la búsqueda).
      expect(v.el.querySelectorAll('app-bandeja lucide-icon svg').length).toBeGreaterThan(1);

      expect(errores).toEqual([]);
    } finally {
      console.error = original;
    }
  });
});

describe('CanalWhatsappComponent suelto (/admin/whatsapp/numero)', () => {
  it('un solo título «Conectar WhatsApp» y los chips propios', async () => {
    const v = await montar(CanalWhatsappComponent, [
      negocio(1, 'Prueba Barbería'),
      negocio(2, 'Prueba Tienda'),
    ]);
    expect(v.titulos()).toEqual(['Conectar WhatsApp']);
    expect(v.cabeceras()).toBe(1);
    expect(v.el.querySelectorAll('[role="tab"]').length).toBe(2);
  });
});
