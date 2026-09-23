import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { describe, it, expect } from 'vitest';

import { AdminService } from '../../data-access/admin.service';
import { CanalWhatsappService } from '../../data-access/canalWhatsapp.service';
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
