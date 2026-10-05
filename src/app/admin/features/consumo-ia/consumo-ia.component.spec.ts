import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ConsumoIaComponent } from './consumo-ia.component';
import { ConsumoIa } from '../../models/consumo-ia.models';
import { environment } from '../../../../environments/environment';

const URL = `${environment.apiUrl}/consumo-ia`;

function datos(parcial: Partial<ConsumoIa> = {}): ConsumoIa {
  return {
    periodo: { dias: 30, desde: '2026-10-01', hasta: '2026-10-03' },
    fuente_saldo: 'oficial',
    aviso_oficial: null,
    consultado_en: '2026-10-03T12:00:00Z',
    saldo: {
      saldo_partida: 10,
      fecha_partida: '2026-10-01T13:00:00Z',
      recargas_posteriores: 0,
      gasto_desde_partida: 1.79,
      saldo_estimado: 8.21,
      promedio_diario_7d: 0.2,
      dias_restantes: 41,
    },
    promedio_diario_7d: 0.2,
    resumen: { hoy: 0.46, mes: 1.79, periodo_oficial: 1.85, periodo_interno: 1.2, proyeccion_mes: 6 },
    serie: [
      { fecha: '2026-10-01', oficial: 0.01, interno: 0 },
      { fecha: '2026-10-02', oficial: 0.45, interno: 0.4 },
      { fecha: '2026-10-03', oficial: 0.36, interno: 0.3 },
    ],
    por_concepto: [{ concepto: 'gpt-5.6-terra, cache writes', usd: 0.81 }],
    por_negocio: [
      { id_negocio: 6, negocio: 'Zona Burger', costo_usd: 1.2, llamadas: 90, conversaciones: 30, costo_por_conversacion: 0.04 },
    ],
    por_modelo: [],
    conversaciones: { con_ia: 30, costo_promedio: 0.04 },
    turnos: { total: 200, con_ia: 50, sin_ia: 150, humano: 0 },
    movimientos: [
      { id_recarga: 1, tipo: 'SALDO', monto_usd: 10, fecha: '2026-10-01T13:00:00Z', nota: 'inicio' },
    ],
    whatsapp: {
      consultado_en: '2026-10-03T12:00:00Z',
      cuentas: [
        {
          nombre: 'Zona Burger',
          paga: 'cliente',
          id_negocio: 6,
          moneda: 'COP',
          error: null,
          mensajes_periodo: 919,
          costo_periodo: 0,
          mensajes_mes: 919,
          costo_mes: 0,
          numeros: [
            {
              telefono: '+57 ··· 8196',
              id_negocio: 6,
              negocio: 'Zona Burger',
              mensajes_mes: 919,
              servicio_mes: 919,
              cobrados_mes: 0,
              costo_mes: 0,
              gratis_limite: 1000,
            },
          ],
          por_categoria: [{ categoria: 'SERVICE', tipo: 'FREE_CUSTOMER_SERVICE', mensajes: 919, costo: 0 }],
        },
      ],
      serie: [
        { fecha: '2026-10-01', escalapp: 0, clientes: 158 },
        { fecha: '2026-10-02', escalapp: 0, clientes: 178 },
      ],
      totales: {
        mensajes_periodo: 919,
        costo_escalapp_mes_cop: 0,
        costo_escalapp_periodo_cop: 0,
        costo_clientes_mes_cop: 0,
        moneda_sin_convertir: false,
      },
    },
    aviso_whatsapp: null,
    trm: { valor: 3273.49, vigente_desde: '2026-10-03' },
    terceros: { openai_mes_usd: 2.92, openai_mes_cop: 9548, whatsapp_mes_cop: 0, total_mes_cop: 9548 },
    ...parcial,
  };
}

describe('ConsumoIaComponent', () => {
  let http: HttpTestingController;

  function montar(respuesta: ConsumoIa) {
    TestBed.configureTestingModule({
      imports: [ConsumoIaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ConsumoIaComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL && r.params.get('dias') === '30').flush({
      success: true,
      message: 'ok',
      data: respuesta,
    });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('muestra saldo, días restantes, gasto y desglose en palabras', () => {
    const el = montar(datos());
    const texto = el.textContent ?? '';
    expect(texto).toContain('$8.21');
    expect(texto).toContain('41');
    expect(texto).toContain('Zona Burger');
    expect(texto).toContain('Guardar en caché');
    expect(texto).toContain('75 %'); // 150 de 200 sin IA
    // 3 barras de OpenAI + 2 de WhatsApp
    expect(el.querySelectorAll('.cia__bar').length).toBe(5);
    expect(el.querySelector('.cia__banner--critico')).toBeNull();
  });

  it('suma terceros en pesos y avisa del número cerca de la cuota gratis, diciendo quién paga', () => {
    const el = montar(datos());
    const texto = (el.textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Pagado a terceros este mes');
    expect(texto).toMatch(/9\.548/);
    expect(texto).toContain('La paga el cliente');
    expect(texto).toContain('919 / 1.000');
    const aviso = el.querySelector('.cia__banner--aviso');
    expect(aviso?.textContent).toContain('conviene confirmar que tenga tarjeta');
  });

  it('si Meta no contesta, lo dice y la parte de OpenAI sigue', () => {
    const el = montar(
      datos({
        whatsapp: null,
        aviso_whatsapp: { code: 'META_ERROR', mensaje: 'sin permiso' },
        terceros: { openai_mes_usd: 2.92, openai_mes_cop: 9548, whatsapp_mes_cop: null, total_mes_cop: null },
      }),
    );
    expect(el.textContent).toContain('Meta no contestó');
    expect(el.textContent).toContain('$8.21');
  });

  it('sin saldo de partida no inventa un saldo y pide registrarlo', () => {
    const el = montar(datos({ saldo: null, movimientos: [] }));
    expect(el.textContent).toContain('Registra abajo el saldo');
    expect(el.textContent).toContain('Registrar saldo');
  });

  it('avisa con texto cuando el saldo alcanza para pocos días', () => {
    const base = datos();
    const el = montar(datos({ saldo: { ...base.saldo!, dias_restantes: 3 } }));
    const banner = el.querySelector('.cia__banner--critico');
    expect(banner?.textContent).toContain('Saldo casi agotado');
  });

  it('si OpenAI no contesta, lo dice y dibuja la cuenta interna', () => {
    const el = montar(
      datos({
        aviso_oficial: { code: 'OPENAI_ADMIN_KEY_RECHAZADA', mensaje: 'x' },
        resumen: { hoy: 0, mes: 0, periodo_oficial: null, periodo_interno: 0.7, proyeccion_mes: 0 },
        serie: [{ fecha: '2026-10-01', oficial: null, interno: 0.7 }],
        por_concepto: [],
      }),
    );
    expect(el.textContent).toContain('OpenAI rechazó la clave');
    expect(el.textContent).toContain('$0.70');
  });
});
