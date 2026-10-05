import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { describe, it, expect } from 'vitest';

import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
import { BandejaService } from '../../data-access/bandeja.service';
import { Negocio } from '../../models/admin.models';
import { WhatsappComponent } from './whatsapp.component';
import { CanalWhatsappComponent } from '../canal-whatsapp/canal-whatsapp.component';
import { AuthService } from '../../../auth/data-access/auth.service';
import { User } from '../../../auth/models/auth.models';

/** Por defecto, un super admin: todo lo de antes de 2026-10-04 se probaba así. */
const SUPER: User = {
  id_usuario: 1, primer_nombre: 'Ana', primer_apellido: 'Admin', email: 'a@a.co',
  negocios: [], roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
};
const cajeroDe = (...ids: number[]): User => ({
  id_usuario: 9, primer_nombre: 'Caro', primer_apellido: 'Caja', email: 'c@c.co', roles_globales: [],
  negocios: ids.map((id) => ({ id_negocio: id, nombre: 'N' + id, roles: [{ id_rol: 5, descripcion: 'CAJERO' }] })),
});

const negocio = (id: number, nombre: string, features?: string[]): Negocio =>
  ({ id_negocio: id, nombre, estado: 'A', features }) as Negocio;

async function montar<T>(
  comp: new () => T,
  negocios: Negocio[],
  conectado = false,
  query: Record<string, string> = {},
  usuario: User = SUPER,
) {
  TestBed.configureTestingModule({
    imports: [comp],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { queryParamMap: of(convertToParamMap(query)), snapshot: { queryParamMap: convertToParamMap(query) } },
      },
      { provide: AdminService, useValue: { getMisNegociosUsuario: () => of(negocios).pipe(delay(5)) } },
      { provide: AuthService, useValue: { currentUser: () => usuario } },
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
          getPreparacion: () => of(null),
          getConfiguracion: () => of({ id_negocio: 1, reactivar_asistente_min: 0, puede_editar: true }),
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
  // Regresión de producción (hotfix de íconos): un <lucide-icon> declarado por quien contiene la
  // bandeja y proyectado dentro de ella se resolvía contra los íconos de la bandeja y cortaba el
  // render («The "smartphone" icon has not been provided…»). La bandeja usa `viewProviders`. Aquí
  // se comprueba que se renderiza completa y sin errores.
  it('renderiza la lista de la bandeja y sus íconos, sin errores', async () => {
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
      expect(v.el.querySelector('app-bandeja')).toBeTruthy();
      expect(v.el.textContent).toContain('Hola, quiero una cita');
      expect(v.el.querySelectorAll('app-bandeja lucide-icon svg').length).toBeGreaterThan(1);
      expect(errores).toEqual([]);
    } finally {
      console.error = original;
    }
  });

  it('con el servicio activo la bandeja ya no trae el botón «Tu número»', async () => {
    const v = await montar(WhatsappComponent, [negocio(1, 'Prueba Barbería', ['asistente_ia'])], true);
    const boton = Array.from(v.el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tu número'),
    );
    expect(boton).toBeFalsy();
  });
});

describe('WhatsappComponent — «Gestionar número»', () => {
  const enlace = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Gestionar número'));

  it('con el número conectado aparece con su engranaje y lleva a la vista de número', async () => {
    const v = await montar(WhatsappComponent, [negocio(1, 'Prueba Barbería', ['asistente_ia'])], true);
    const boton = enlace(v.el);
    expect(boton).toBeTruthy();
    expect(boton!.querySelector('lucide-icon svg')).toBeTruthy();

    boton!.click();
    await v.esperar();
    // Ya está en la vista de número: sin bandeja, sin el enlace, y con la vuelta a las conversaciones.
    expect(v.el.querySelector('app-bandeja')).toBeFalsy();
    expect(enlace(v.el)).toBeFalsy();
    expect(v.el.textContent).toContain('Ver conversaciones');
  });

  // Desde 2026-10-02 va en la cabecera de la Bandeja: la fila de arriba le quitaba alto a los
  // mensajes y, con un solo negocio, existía solo para este botón.
  it('con un negocio: va en la cabecera de la Bandeja y no hay fila de arriba', async () => {
    const uno = await montar(WhatsappComponent, [negocio(1, 'Prueba Barbería', ['asistente_ia'])], true);
    expect(uno.el.querySelector('.wa__barra')).toBeFalsy();
    expect(enlace(uno.el)?.closest('.bdj__top')).toBeTruthy();
  });

  it('con varios negocios: la fila de arriba solo lleva los negocios', async () => {
    const varios = await montar(
      WhatsappComponent,
      [negocio(1, 'Prueba Barbería', ['asistente_ia']), negocio(2, 'Prueba Tienda', ['asistente_ia'])],
      true,
    );
    const barra = varios.el.querySelector('.wa__barra') as HTMLElement;
    expect(barra.querySelector('[role="tab"]')).toBeTruthy();
    expect(enlace(barra)).toBeFalsy();
    expect(enlace(varios.el)?.closest('.bdj__top')).toBeTruthy();
  });

  it('sin conectar no aparece (ya está en esa vista)', async () => {
    const v = await montar(WhatsappComponent, [negocio(1, 'Prueba Barbería', ['asistente_ia'])], false);
    expect(enlace(v.el)).toBeFalsy();
  });

  it('sin la feature tampoco aparece', async () => {
    const v = await montar(WhatsappComponent, [negocio(1, 'Prueba Barbería', ['otra'])], true);
    expect(enlace(v.el)).toBeFalsy();
  });
});

describe('WhatsappComponent — ?negocio=<id> (campana y «Ver planes»)', () => {
  it('abre con ese negocio seleccionado', async () => {
    const v = await montar(
      WhatsappComponent,
      [
        negocio(1, 'Prueba Barbería', ['asistente_ia']),
        negocio(2, 'Prueba Restaurante', ['asistente_ia']),
        negocio(3, 'Prueba Tienda', ['asistente_ia']),
      ],
      false,
      { negocio: '3' },
    );
    const seleccionado = v.el.querySelector('[role="tab"][aria-selected="true"]');
    expect(seleccionado?.textContent).toContain('Prueba Tienda');
  });

  it('un id que no es de sus negocios se ignora (multi-tenant): queda el primero', async () => {
    const v = await montar(
      WhatsappComponent,
      [negocio(1, 'Prueba Barbería', ['asistente_ia']), negocio(2, 'Prueba Tienda', ['asistente_ia'])],
      false,
      { negocio: '999' },
    );
    const seleccionado = v.el.querySelector('[role="tab"][aria-selected="true"]');
    expect(seleccionado?.textContent).toContain('Prueba Barbería');
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

describe('WhatsappComponent — el cajero (2026-10-04)', () => {
  it('con el plan y número conectado: ve las conversaciones, sin «Gestionar número»', async () => {
    const v = await montar(WhatsappComponent, [negocio(1, 'Zona', ['asistente_ia'])], true, {}, cajeroDe(1));
    expect(v.el.querySelector('app-bandeja')).toBeTruthy();
    expect(v.el.textContent).not.toContain('Gestionar número');
  });

  it('sin número conectado: le pide al administrador que lo conecte (no ve cómo conectarlo)', async () => {
    const v = await montar(WhatsappComponent, [negocio(1, 'Zona', ['asistente_ia'])], false, {}, cajeroDe(1));
    expect(v.el.textContent).toContain('Pídele al administrador');
    expect(v.el.querySelector('app-canal-whatsapp')).toBeFalsy();
  });

  it('solo ve los negocios cuyo plan incluye WhatsApp', async () => {
    const v = await montar(
      WhatsappComponent,
      [negocio(1, 'Con plan', ['asistente_ia']), negocio(2, 'Sin plan', [])],
      true,
      {},
      cajeroDe(1, 2),
    );
    expect(v.el.textContent).not.toContain('Sin plan');
    expect(v.el.textContent).not.toContain('Mejora tu plan');
  });
});
