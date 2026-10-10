import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { CarteraComponent } from './cartera.component';
import { CatalogosCartera, ResumenCartera } from '../../models/cartera.models';
import { environment } from '../../../../environments/environment';

const URL = `${environment.apiUrl}/cartera`;

const CATALOGOS: CatalogosCartera = {
  cuentas: [
    { id_cuenta: 1, codigo: 'BANCO', nombre: 'Bancolombia', tipo: 'banco', moneda: 'COP', aplica_gmf: true,
      pasarela: 'manual', saldo_inicial: 0, fecha_saldo: null, nota: null, estado: 'A', orden: 1 },
    { id_cuenta: 2, codigo: 'WOMPI', nombre: 'Saldo en Wompi', tipo: 'pasarela', moneda: 'COP', aplica_gmf: false,
      pasarela: 'wompi', saldo_inicial: 0, fecha_saldo: null, nota: null, estado: 'A', orden: 2 },
  ],
  categorias: [
    { id_categoria: 1, codigo: 'MENSUALIDADES', nombre: 'Mensualidades', tipo: 'ingreso', sistema: true, estado: 'A' },
    { id_categoria: 10, codigo: 'INFRAESTRUCTURA', nombre: 'Servidores', tipo: 'egreso', sistema: false, estado: 'A' },
  ],
  tarifas: [],
  trm: { valor: 4000, vigente_desde: '2026-10-09' },
  tasa_gmf: 0.004,
};

function resumen(): ResumenCartera {
  return {
    rango: { desde: '2026-10-01', hasta: '2026-10-09' },
    cifras: {
      ingresos: 100000, egresos: 20000, comisiones_pasarela: 5000, comisiones_bancarias: 0,
      iva_comisiones: 800, comisiones: 5000, gmf: 80, gmf_deducible: 40, retenciones: 0,
      iva_compras: 0, resultado: 74920, caja_neta: 74920, margen: 0.749, n_ingresos: 2,
      n_egresos: 1, estimados: 2, sin_tasa: 0,
    },
    ingresos_por_categoria: [{ id_categoria: 1, nombre: 'Mensualidades', total: 100000, movimientos: 2 }],
    egresos_por_categoria: [{ id_categoria: 10, nombre: 'Servidores', total: 20000, movimientos: 1 }],
    ingresos_por_tercero: [{ tercero: 'Zona Burger', total: 100000, movimientos: 2 }],
    por_mes: [{ mes: '2026-10', ingresos: 100000, egresos: 20000, costos_financieros: 5080, retenciones: 0, resultado: 74920 }],
    cuentas: [{ id_cuenta: 1, nombre: 'Bancolombia', tipo: 'banco', aplica_gmf: true, estado: 'A', saldo: 74920 }],
    saldo_total: 74920,
    por_cobrar: { total: 59999, facturas: 1, negocios: 1 },
    sincronizacion: { mensualidades: 0, recargas: 0, anulados: 0 },
  };
}

describe('CarteraComponent', () => {
  let http: HttpTestingController;

  async function montar() {
    await TestBed.configureTestingModule({
      imports: [CarteraComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CarteraComponent);
    fixture.detectChanges();
    http.expectOne(`${URL}/catalogos`).flush({ success: true, data: CATALOGOS });
    http.expectOne((r) => r.url === `${URL}/resumen`).flush({ success: true, data: resumen() });
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, c: fixture.componentInstance as any, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  it('enseña resultado, 4x1000 y el aviso de cifras estimadas', async () => {
    const { el } = await montar();
    const texto = el.textContent ?? '';
    expect(texto).toContain('Resultado');
    expect(texto).toContain('4x1000');
    expect(texto).toContain('estimadas');
    expect(texto).toContain('Zona Burger');
  });

  it('un gasto desde el banco calcula el 4x1000 sobre monto + comisión', async () => {
    const { c } = await montar();
    c.nuevo('egreso');
    expect(c.form().id_cuenta).toBe(1);
    c.numero('monto', 100000);
    c.numero('comision', 5000);
    expect(c.gmfCalculado()).toBe(420);
    expect(c.netoForm()).toBe(-105420);
  });

  it('desde Wompi o marcado exento no paga 4x1000', async () => {
    const { c } = await montar();
    c.nuevo('egreso');
    c.numero('monto', 100000);
    c.campo('exento_gmf', true);
    expect(c.gmfCalculado()).toBe(0);
    c.campo('exento_gmf', false);
    c.campo('id_cuenta', 2);
    expect(c.gmfCalculado()).toBe(0);
  });

  it('un ingreso descuenta comisión y retención, nunca 4x1000', async () => {
    const { c } = await montar();
    c.nuevo('ingreso');
    c.numero('monto', 2000000);
    c.numero('retencion', 220000);
    expect(c.gmfCalculado()).toBe(0);
    expect(c.netoForm()).toBe(1780000);
  });

  it('en dólares propone la TRM y convierte', async () => {
    const { c } = await montar();
    c.nuevo('egreso');
    c.cambiarMoneda('USD');
    expect(c.form().tasa_cop).toBe(4000);
    c.numero('monto', 10);
    expect(c.netoForm()).toBe(-(40000 + 160));
  });

  it('no envía sin categoría y avisa', async () => {
    const { c } = await montar();
    c.nuevo('egreso');
    c.numero('monto', 1000);
    c.guardar();
    expect(c.errorForm()).toContain('categoría');
    http.expectNone(`${URL}/movimientos`);
  });

  it('el 4x1000 tecleado viaja; el calculado va como null para que lo decida el servidor', async () => {
    const { c } = await montar();
    c.nuevo('egreso');
    c.numero('monto', 1000);
    c.campo('id_categoria', 10);
    c.guardar();
    const req = http.expectOne(`${URL}/movimientos`);
    expect(req.request.body.gmf).toBeNull();
    req.flush({ success: true, data: {} });
    http.expectOne((r) => r.url === `${URL}/resumen`).flush({ success: true, data: resumen() });
  });
});
