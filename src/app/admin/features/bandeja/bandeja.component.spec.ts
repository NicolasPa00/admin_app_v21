import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';

import { BandejaService } from '../../data-access/bandeja.service';
import { ConversacionBandeja, ConversacionBandejaDetalle, MensajeBandeja } from '../../models/bandeja.models';
import { BandejaComponent } from './bandeja.component';

const base = (over: Partial<ConversacionBandeja>): ConversacionBandeja => ({
  id_conversacion: 'c1',
  id_negocio: 1,
  estado: 'activa',
  canal: 'whatsapp',
  id_externo: '573001112233',
  creado_en: '2026-09-23T10:00:00',
  ultimo_mensaje_en: '2026-09-23T10:05:00',
  negocio: 'Prueba Barbería',
  persona: null,
  telefono_e164: null,
  escalada: false,
  ultimo_texto: 'Hola',
  reportes: 0,
  ...over,
});

const CON_NOMBRE = base({ id_conversacion: 'c1', persona: 'Ana Prueba', telefono_e164: '+573001112233' });
const SIN_NOMBRE = base({ id_conversacion: 'c2', id_externo: '573104445566', telefono_e164: '+573104445566' });
const SIN_NADA = base({ id_conversacion: 'c3', id_externo: '', telefono_e164: null });

interface OpcionesDetalle {
  reactivarMin?: number;
  humanoUltimoEn?: string | null;
  retomadas?: ConversacionBandejaDetalle['retomadas'];
}

const detalle = (
  c: ConversacionBandeja,
  ventanaAbierta: boolean,
  extra: OpcionesDetalle = {},
): ConversacionBandejaDetalle => ({
  disponible: true,
  conversacion: {
    ...c,
    estado: 'handoff_humano',
    reactivar_asistente_min: extra.reactivarMin ?? 0,
    humano_ultimo_en: extra.humanoUltimoEn ?? null,
  },
  retomadas: extra.retomadas ?? [],
  mensajes: [],
  ventana: { abierta: ventanaAbierta, ultimo_entrante_en: '2026-09-23T10:05:00', expira_en: null },
  reportes: { persona: 0, conversacion: 0, del_asistente: 0, mio: null, ultimo: null },
  motivos: [],
});

async function montar(
  opts: {
    ventanaAbierta?: boolean;
    conversaciones?: ConversacionBandeja[];
    config?: {
      reactivar_asistente_min: number;
      puede_editar: boolean;
      tiempo_estimado_min?: number | null;
      tiempo_estimado_max?: number | null;
    };
    detalle?: OpcionesDetalle;
    mensajes?: MensajeBandeja[];
    archivo?: (idConversacion: string, idMensaje: string) => unknown;
  } = {},
) {
  const guardarConfiguracion = vi.fn((id: number, minutos: number) =>
    of({ id_negocio: id, reactivar_asistente_min: minutos }),
  );
  const guardarTiempoEstimado = vi.fn((id: number, min: number | null, max: number | null) =>
    of({ id_negocio: id, reactivar_asistente_min: 0, tiempo_estimado_min: min, tiempo_estimado_max: max }),
  );
  const responder = vi.fn(() => of({ id_mensaje: 'm1', estado_conversacion: 'handoff_humano', estado_entrega: 'pendiente' }));
  const conversaciones = opts.conversaciones ?? [CON_NOMBRE, SIN_NOMBRE, SIN_NADA];
  TestBed.configureTestingModule({
    imports: [BandejaComponent],
    providers: [
      {
        provide: BandejaService,
        useValue: {
          getConversaciones: () =>
            of({
              disponible: true,
              negocios: [{ id_negocio: 1, nombre: 'Prueba Barbería' }],
              conversaciones,
            }),
          getConversacion: (id: string) =>
            of({
              ...detalle(conversaciones.find((c) => c.id_conversacion === id)!, opts.ventanaAbierta ?? true, opts.detalle),
              mensajes: opts.mensajes ?? [],
            }),
          archivoDeMensaje: opts.archivo ?? (() => of(new Blob(['x'], { type: 'image/jpeg' }))),
          responder,
          getPreparacion: () => of({ tipo: "RESTAURANTE", criticos: 0, pendientes: 0, puntos: [] }),
          getConfiguracion: (idNegocio: number) =>
            of({ id_negocio: idNegocio, ...(opts.config ?? { reactivar_asistente_min: 0, puede_editar: true }) }),
          guardarConfiguracion,
          guardarTiempoEstimado,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(BandejaComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, responder, guardarConfiguracion, guardarTiempoEstimado, tick: () => fixture.detectChanges() };
}

function teclear(el: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

describe('Bandeja — lista de chats', () => {
  it('muestra el NOMBRE del cliente, con su inicial en el avatar', async () => {
    const v = await montar();
    const items = Array.from(v.el.querySelectorAll('.bdj__item'));
    const ana = items[0];
    expect(ana.querySelector('.bdj__item-quien')?.textContent?.trim()).toBe('Ana Prueba');
    expect(ana.querySelector('.bdj__avatar')?.textContent?.trim()).toBe('A');
    expect(ana.querySelector('.bdj__avatar svg')).toBeFalsy();
  });

  it('sin nombre muestra el número formateado y un ícono de persona', async () => {
    const v = await montar();
    const sin = Array.from(v.el.querySelectorAll('.bdj__item'))[1];
    expect(sin.querySelector('.bdj__item-quien')?.textContent?.trim()).toBe('+57 310 444 5566');
    expect(sin.querySelector('.bdj__avatar')?.textContent?.trim()).toBe('');
    expect(sin.querySelector('.bdj__avatar lucide-icon svg')).toBeTruthy();
  });

  it('sin nombre ni número: «Sin identificar»', async () => {
    const v = await montar();
    const nada = Array.from(v.el.querySelectorAll('.bdj__item'))[2];
    expect(nada.querySelector('.bdj__item-quien')?.textContent?.trim()).toBe('Sin identificar');
  });

  // Zona Burger, 2026-10-02: «CO.1084387837819952» se veía como «+1084387837819952».
  it('un usuario de WhatsApp sin número NO se muestra como teléfono', async () => {
    const v = await montar();
    const bsuid = base({ id_externo: 'CO.1084387837819952', telefono_e164: null });
    const c = v.fixture.componentInstance;
    expect(c.quien(bsuid)).toBe('Cliente sin número visible');
    expect(c.contacto(bsuid)).toBe('WhatsApp no comparte su número');
    // Un número de verdad sigue saliendo como número.
    expect(c.esIdSinNumero('573104445566')).toBe(false);
    expect(c.contacto(SIN_NOMBRE)).toBe('+573104445566');
  });
});

describe('Bandeja — estado vacío', () => {
  it('sin chat abierto: marca de agua «EscalApp» y nada de la malla de íconos', async () => {
    const v = await montar();
    expect(v.el.querySelector('.bdj__hilo-head')).toBeFalsy();
    expect(v.el.querySelector('.bdj__mensajes')).toBeFalsy();
    const marca = v.el.querySelector('.bdj__marca-agua');
    expect(marca?.textContent?.trim()).toBe('EscalApp');
    expect(marca?.getAttribute('aria-hidden')).toBe('true');
    // El estado vacío no lleva la malla de garabatos: esa es del chat abierto.
    const placeholder = v.el.querySelector('.bdj__placeholder') as HTMLElement;
    expect(getComputedStyle(placeholder).backgroundImage).not.toContain('url(');
  });

  it('con un chat abierto aparece el chat (la malla vive en .bdj__mensajes) y la marca de agua se va', async () => {
    const v = await montar();
    (v.el.querySelector('.bdj__item') as HTMLElement).click();
    v.tick();
    expect(v.el.querySelector('.bdj__mensajes')).toBeTruthy();
    expect(v.el.querySelector('.bdj__marca-agua')).toBeFalsy();
  });
});

describe('Bandeja — Enter envía, Shift+Enter hace salto de línea', () => {
  async function conChat(ventanaAbierta: boolean) {
    const v = await montar({ ventanaAbierta });
    (v.el.querySelector('.bdj__item') as HTMLElement).click();
    v.tick();
    return v;
  }

  it('Enter envía el mensaje y no mete un salto de línea', async () => {
    const v = await conChat(true);
    const caja = v.el.querySelector('textarea.bdj__texto') as HTMLTextAreaElement;
    caja.value = 'Hola, ya te ayudo';
    caja.dispatchEvent(new Event('input', { bubbles: true }));
    v.tick();

    const ev = teclear(caja, { key: 'Enter' });
    expect(ev.defaultPrevented).toBe(true);
    expect(v.responder).toHaveBeenCalledTimes(1);
    expect(v.responder).toHaveBeenCalledWith('c1', 'Hola, ya te ayudo');
  });

  it('Shift+Enter NO envía y deja el salto de línea', async () => {
    const v = await conChat(true);
    const caja = v.el.querySelector('textarea.bdj__texto') as HTMLTextAreaElement;
    caja.value = 'Línea uno';
    caja.dispatchEvent(new Event('input', { bubbles: true }));
    v.tick();

    const ev = teclear(caja, { key: 'Enter', shiftKey: true });
    expect(ev.defaultPrevented).toBe(false);
    expect(v.responder).not.toHaveBeenCalled();
  });

  it('con un borrador vacío Enter no envía nada', async () => {
    const v = await conChat(true);
    const caja = v.el.querySelector('textarea.bdj__texto') as HTMLTextAreaElement;
    teclear(caja, { key: 'Enter' });
    expect(v.responder).not.toHaveBeenCalled();
  });

  it('con la ventana de 24 h cerrada no hay caja de texto: no se puede enviar', async () => {
    const v = await conChat(false);
    expect(v.el.querySelector('textarea.bdj__texto')).toBeFalsy();
    expect(v.responder).not.toHaveBeenCalled();
  });

  it('no envía mientras se compone con un IME (Enter confirma la composición)', async () => {
    const v = await conChat(true);
    const caja = v.el.querySelector('textarea.bdj__texto') as HTMLTextAreaElement;
    caja.value = 'texto';
    caja.dispatchEvent(new Event('input', { bubbles: true }));
    v.tick();
    teclear(caja, { key: 'Enter', isComposing: true });
    expect(v.responder).not.toHaveBeenCalled();
  });
});

describe('Bandeja — «Esperan respuesta»', () => {
  it('con conversaciones esperando el chip se marca (alerta) y muestra el contador; con 0 es normal', async () => {
    const esperando = await montar({ conversaciones: [{ ...CON_NOMBRE, escalada: true }, SIN_NOMBRE] });
    const chip = esperando.el.querySelector('.bdj__chip--espera') as HTMLElement;
    expect(chip.classList.contains('bdj__chip--alerta')).toBe(true);
    expect(chip.querySelector('.bdj__contador--alerta')?.textContent?.trim()).toBe('1');
  });

  it('sin nadie esperando el chip no lleva la marca de alerta', async () => {
    const tranquilo = await montar({ conversaciones: [CON_NOMBRE] });
    const chip = tranquilo.el.querySelector('.bdj__chip--espera') as HTMLElement;
    expect(chip.classList.contains('bdj__chip--alerta')).toBe(false);
    expect(chip.querySelector('.bdj__contador')).toBeFalsy();
  });
});

describe('Bandeja — «Reportar usuario» (reporta y bloquea)', () => {
  it('el hilo tiene UNA sola opción de moderación y abre el modal', async () => {
    const v = await montar();
    (v.el.querySelector('.bdj__item') as HTMLElement).click();
    v.tick();

    const botones = Array.from(v.el.querySelectorAll('.bdj__hilo-head button')).map((b) => b.textContent?.trim());
    expect(botones.filter((t) => t === 'Reportar usuario')).toHaveLength(1);
    expect(botones.some((t) => /Bloquear|Reportar mal uso|Reportada/.test(t ?? ''))).toBe(false);

    const abrir = Array.from(v.el.querySelectorAll('.bdj__hilo-head button')).find((b) =>
      b.textContent?.includes('Reportar usuario'),
    ) as HTMLElement;
    abrir.click();
    v.tick();
    expect(v.el.querySelector('.bdj-modal')).toBeTruthy();
    expect(v.el.querySelector('#bdj-rep-title')?.textContent?.trim()).toBe('Reportar usuario');
    const acciones = Array.from(v.el.querySelectorAll('.bdj-modal__pie button')).map((b) => b.textContent?.trim());
    expect(acciones).toEqual(['Cancelar', 'Reportar y bloquear']);
  });
});


describe('Bandeja — el asistente vuelve solo (ADR-023, Enmienda 2)', () => {
  const input = (el: HTMLElement, sel: string) => el.querySelector(sel) as HTMLInputElement;
  const escribir = (i: HTMLInputElement, valor: string) => {
    i.value = valor;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('de fábrica es «Nunca»: la casilla marcada y los minutos deshabilitados', async () => {
    const v = await montar();
    expect(input(v.el, '.bdj__auto-nunca input').checked).toBe(true);
    expect(input(v.el, '.bdj__auto-min').disabled).toBe(true);
    expect(v.el.querySelector('.bdj__auto-guardar')).toBeFalsy(); // nada que guardar
  });

  it('desmarcar «Nunca» propone 30 minutos y guarda con toast', async () => {
    const v = await montar();
    const nunca = input(v.el, '.bdj__auto-nunca input');
    nunca.click();
    v.tick();
    // `[disabled]` sobre un ngModel se aplica en una microtarea: se espera a que asiente.
    await v.fixture.whenStable();
    v.tick();
    expect(input(v.el, '.bdj__auto-min').disabled).toBe(false);
    expect(input(v.el, '.bdj__auto-min').value).toBe('30');

    (v.el.querySelector('.bdj__auto-guardar') as HTMLElement).click();
    expect(v.guardarConfiguracion).toHaveBeenCalledWith(1, 30);
  });

  it('cambia los minutos y guarda ese valor', async () => {
    const v = await montar({ config: { reactivar_asistente_min: 15, puede_editar: true } });
    expect(input(v.el, '.bdj__auto-min').value).toBe('15');
    escribir(input(v.el, '.bdj__auto-min'), '45');
    v.tick();
    (v.el.querySelector('.bdj__auto-guardar') as HTMLElement).click();
    expect(v.guardarConfiguracion).toHaveBeenCalledWith(1, 45);
  });

  it('volver a «Nunca» guarda 0', async () => {
    const v = await montar({ config: { reactivar_asistente_min: 30, puede_editar: true } });
    input(v.el, '.bdj__auto-nunca input').click();
    v.tick();
    (v.el.querySelector('.bdj__auto-guardar') as HTMLElement).click();
    expect(v.guardarConfiguracion).toHaveBeenCalledWith(1, 0);
  });

  it('quien no es administrador de ese negocio la ve pero no la puede cambiar', async () => {
    const v = await montar({ config: { reactivar_asistente_min: 30, puede_editar: false } });
    expect(input(v.el, '.bdj__auto-nunca input').disabled).toBe(true);
    expect(input(v.el, '.bdj__auto-min').disabled).toBe(true);
  });

  it('un valor fuera de rango no se puede guardar', async () => {
    const v = await montar({ config: { reactivar_asistente_min: 30, puede_editar: true } });
    escribir(input(v.el, '.bdj__auto-min'), '0');
    v.tick();
    expect((v.el.querySelector('.bdj__auto-guardar') as HTMLButtonElement).disabled).toBe(true);
  });

  describe('en el hilo', () => {
    async function abrir(extra: OpcionesDetalle) {
      const v = await montar({ detalle: extra });
      (v.el.querySelector('.bdj__item') as HTMLElement).click();
      v.tick();
      return v;
    }

    it('con «nunca» avisa que no volverá solo', async () => {
      const v = await abrir({ reactivarMin: 0 });
      expect(v.el.querySelector('.bdj__retomar-aviso')?.textContent).toContain('no volverá solo');
    });

    it('con plazo y una intervención reciente dice a qué hora vuelve', async () => {
      const v = await abrir({ reactivarMin: 30, humanoUltimoEn: new Date().toISOString() });
      expect(v.el.querySelector('.bdj__retomar-aviso')?.textContent).toMatch(/vuelve a las .* si el cliente escribe/);
    });

    it('si nadie ha intervenido explica desde cuándo cuenta', async () => {
      const v = await abrir({ reactivarMin: 30, humanoUltimoEn: null });
      expect(v.el.querySelector('.bdj__retomar-aviso')?.textContent).toContain('después de que respondas');
    });

    it('con el plazo ya cumplido lo dice', async () => {
      const v = await abrir({
        reactivarMin: 30,
        humanoUltimoEn: new Date(Date.now() - 3 * 3600_000).toISOString(),
      });
      expect(v.el.querySelector('.bdj__retomar-aviso')?.textContent).toContain('ya se cumplió');
    });

    it('cuenta en el hilo que el asistente retomó, automático y manual', async () => {
      const v = await abrir({
        retomadas: [
          { fecha: '2026-09-23T10:30:00', origen: 'automatico', quien: null },
          { fecha: '2026-09-23T11:30:00', origen: 'manual', quien: 'Ana Admin' },
        ],
      });
      const eventos = Array.from(v.el.querySelectorAll('.bdj__evento')).map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
      expect(eventos).toHaveLength(2);
      expect(eventos[0]).toContain('El asistente retomó la conversación (automático');
      expect(eventos[1]).toContain('manual, por Ana Admin');
    });
  });
});

describe('Bandeja — tiempo estimado de entrega (lo que el asistente contesta a «¿cuánto se demora?»)', () => {
  const MIN = 'input[aria-label="Minutos mínimos de entrega"]';
  const MAX = 'input[aria-label="Minutos máximos de entrega (opcional)"]';
  const GUARDAR = '[aria-label="Tiempo estimado de entrega"] .bdj__auto-guardar';
  const input = (el: HTMLElement, sel: string) => el.querySelector(sel) as HTMLInputElement;
  const escribir = (i: HTMLInputElement, valor: string) => {
    i.value = valor;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('sin configurar: los campos vacíos, el máximo deshabilitado y nada que guardar', async () => {
    const v = await montar();
    expect(input(v.el, MIN).value).toBe('');
    expect(input(v.el, MAX).disabled).toBe(true);
    expect(v.el.querySelector(GUARDAR)).toBeFalsy();
  });

  it('muestra lo guardado («de 40 a 60»)', async () => {
    const v = await montar({
      config: { reactivar_asistente_min: 0, puede_editar: true, tiempo_estimado_min: 40, tiempo_estimado_max: 60 },
    });
    expect(input(v.el, MIN).value).toBe('40');
    expect(input(v.el, MAX).value).toBe('60');
  });

  it('escribe «de 40 a 60» y guarda ese rango', async () => {
    const v = await montar();
    escribir(input(v.el, MIN), '40');
    v.tick();
    await v.fixture.whenStable();
    v.tick();
    escribir(input(v.el, MAX), '60');
    v.tick();
    (v.el.querySelector(GUARDAR) as HTMLElement).click();
    expect(v.guardarTiempoEstimado).toHaveBeenCalledWith(1, 40, 60);
  });

  it('solo el mínimo → el máximo va vacío («unos X minutos»)', async () => {
    const v = await montar();
    escribir(input(v.el, MIN), '45');
    v.tick();
    (v.el.querySelector(GUARDAR) as HTMLElement).click();
    expect(v.guardarTiempoEstimado).toHaveBeenCalledWith(1, 45, null);
  });

  it('un máximo menor que el mínimo no se puede guardar', async () => {
    const v = await montar({
      config: { reactivar_asistente_min: 0, puede_editar: true, tiempo_estimado_min: 40, tiempo_estimado_max: 60 },
    });
    escribir(input(v.el, MAX), '20');
    v.tick();
    expect((v.el.querySelector(GUARDAR) as HTMLButtonElement).disabled).toBe(true);
  });

  it('vaciar el mínimo borra el tiempo (guarda null)', async () => {
    const v = await montar({
      config: { reactivar_asistente_min: 0, puede_editar: true, tiempo_estimado_min: 40, tiempo_estimado_max: 60 },
    });
    escribir(input(v.el, MIN), '');
    v.tick();
    await v.fixture.whenStable();
    v.tick();
    // sin mínimo no hay máximo: queda vacío también
    escribir(input(v.el, MAX), '');
    v.tick();
    (v.el.querySelector(GUARDAR) as HTMLElement).click();
    expect(v.guardarTiempoEstimado).toHaveBeenCalledWith(1, null, null);
  });

  it('quien no es administrador de ese negocio lo ve pero no lo puede cambiar', async () => {
    const v = await montar({
      config: { reactivar_asistente_min: 0, puede_editar: false, tiempo_estimado_min: 40, tiempo_estimado_max: 60 },
    });
    expect(input(v.el, MIN).disabled).toBe(true);
    expect(input(v.el, MAX).disabled).toBe(true);
  });
});

// Fotos, stickers y audios del cliente (2026-10-02): se traen al abrir el chat, sin guardar copia.
describe('Bandeja — archivos del cliente', () => {
  const msg = (over: Partial<MensajeBandeja>): MensajeBandeja => ({
    id_mensaje: 'm-foto',
    direccion: 'entrante',
    canal: 'whatsapp',
    contenido: '[image]',
    estado_entrega: null,
    enviado_en: null,
    entregado_en: null,
    creado_en: '2026-10-02T20:00:00',
    media: { tipo: 'image', mime: 'image/jpeg', caption: 'el comprobante', nombre: null },
    ...over,
  });
  const abrirPrimera = async (v: Awaited<ReturnType<typeof montar>>) => {
    (v.el.querySelector('.bdj__item') as HTMLElement).click();
    v.tick();
    await v.fixture.whenStable();
    v.tick();
  };

  it('una foto se ve en el hilo (en vez de «[image]»), con su pie', async () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba-foto');
    const archivo = vi.fn(() => of(new Blob(['x'], { type: 'image/jpeg' })));
    const v = await montar({ mensajes: [msg({})], archivo });
    await abrirPrimera(v);

    expect(archivo).toHaveBeenCalledWith('c1', 'm-foto');
    const img = v.el.querySelector('.bdj__archivo img') as HTMLImageElement;
    expect(img?.getAttribute('src')).toBe('blob:prueba-foto');
    expect(v.el.querySelector('.bdj__mensajes')?.textContent).toContain('el comprobante');
    expect(v.el.querySelector('.bdj__mensajes')?.textContent).not.toContain('[image]');
    crear.mockRestore();
  });

  it('pasados 7 días (410) lo dice, en vez de una imagen rota', async () => {
    const archivo = vi.fn(() => throwError(() => ({ status: 410 })));
    const v = await montar({ mensajes: [msg({})], archivo });
    await abrirPrimera(v);

    expect(v.el.querySelector('.bdj__archivo-aviso')?.textContent).toContain('7 días');
    expect(v.el.querySelector('.bdj__archivo img')).toBeFalsy();
  });

  it('un documento NO se descarga solo: es un botón', async () => {
    const archivo = vi.fn(() => of(new Blob(['%PDF'])));
    const v = await montar({
      mensajes: [msg({ media: { tipo: 'document', mime: 'application/pdf', caption: null, nombre: 'factura.pdf' } })],
      archivo,
    });
    await abrirPrimera(v);

    expect(archivo).not.toHaveBeenCalled();
    expect(v.el.querySelector('.bdj__archivo-doc')?.textContent).toContain('factura.pdf');
  });
});

// Pedido del dueño (2026-10-02): en «Todos», las que esperan respuesta arriba y recuadradas; y los
// mensajes editados o borrados desde WhatsApp se ven como tales.
describe('Bandeja — esperan respuesta arriba, y mensajes editados/eliminados', () => {
  it('en «Todos» la que espera va primero y lleva el recuadro', async () => {
    const espera = base({ id_conversacion: 'c9', persona: 'Zoe Espera', escalada: true });
    const v = await montar({ conversaciones: [CON_NOMBRE, SIN_NOMBRE, espera] });

    const items = Array.from(v.el.querySelectorAll('.bdj__item'));
    expect(items[0].querySelector('.bdj__item-quien')?.textContent?.trim()).toBe('Zoe Espera');
    expect(items[0].classList.contains('bdj__item--espera')).toBe(true);
    expect(items[1].classList.contains('bdj__item--espera')).toBe(false);
  });

  it('un mensaje editado dice «Editado»; uno eliminado no enseña su texto', async () => {
    const m = (over: Partial<MensajeBandeja>): MensajeBandeja => ({
      id_mensaje: 'x', direccion: 'entrante', canal: 'whatsapp', contenido: '', estado_entrega: null,
      enviado_en: null, entregado_en: null, creado_en: '2026-10-02T21:43:00', ...over,
    });
    const v = await montar({
      mensajes: [
        m({ id_mensaje: 'e1', contenido: 'Si perfecto', editado: true }),
        m({ id_mensaje: 'e2', contenido: '', eliminado: true }),
      ],
    });
    (v.el.querySelector('.bdj__item') as HTMLElement).click();
    v.tick();
    await v.fixture.whenStable();
    v.tick();

    const hilo = v.el.querySelector('.bdj__mensajes')?.textContent ?? '';
    expect(hilo).toContain('Si perfecto');
    expect(hilo).toContain('Editado');
    expect(hilo).toContain('Mensaje eliminado');
    expect(hilo).not.toContain('[edit]');
  });
});

// Pedido del dueño (2026-10-02): el recuadro se quita al ABRIR la conversación, sin contestar; y
// vuelve si el cliente escribe algo nuevo.
describe('Bandeja — el recuadro de «espera respuesta» se quita al abrir', () => {
  afterEach(() => localStorage.removeItem('bandeja_vistas_v1'));

  it('abrirla quita el recuadro; un mensaje nuevo del cliente lo devuelve', async () => {
    localStorage.removeItem('bandeja_vistas_v1');
    const espera = base({ id_conversacion: 'c9', persona: 'Zoe Espera', escalada: true, ultimo_mensaje_en: '2026-10-02T21:00:00' });
    const v = await montar({ conversaciones: [espera, CON_NOMBRE] });
    const primera = () => v.el.querySelector('.bdj__item') as HTMLElement;

    expect(primera().classList.contains('bdj__item--espera')).toBe(true);
    primera().click();
    v.tick();
    expect(primera().classList.contains('bdj__item--espera')).toBe(false);

    // Llega otro mensaje del cliente: cambia ultimo_mensaje_en y el recuadro vuelve.
    const c = v.fixture.componentInstance;
    expect(c.recuadroEspera({ ...espera, ultimo_mensaje_en: '2026-10-02T21:05:00' })).toBe(true);
  });
});
