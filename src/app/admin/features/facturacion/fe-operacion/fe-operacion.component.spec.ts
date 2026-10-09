import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FacturacionService } from '../../../data-access/facturacion.service';
import { FeVista } from '../../../models/facturacion.models';
import { FeOperacionComponent } from './fe-operacion.component';

const vista = (extra: Partial<FeVista> = {}): FeVista => ({
  config: {
    id_negocio: 17,
    proveedor: 'FACTUS',
    ambiente: 'PRUEBAS',
    estado: 'EN_PRUEBAS',
    impuesto_defecto_codigo: 'ZZ',
    impuesto_defecto_tarifa: '0.00',
    impuesto_domicilio_codigo: 'ZZ',
    impuesto_domicilio_tarifa: '0.00',
    enviar_correo: true,
    facturar_todo: false,
    activado_en: null,
    tiene_credenciales: true,
  },
  rangos: [
    {
      id_resolucion: 'r-1',
      id_rango_proveedor: 389,
      tipo_documento: 'FV',
      prefijo: 'SETP',
      numero_resolucion: '18760000001',
      rango_desde: 990000000,
      rango_hasta: 995000000,
      consecutivo_actual: 990000010,
      vigencia_hasta: '2030-01-19',
      vencida: false,
      en_uso: false,
    },
  ],
  puede_emitir: { puede: true, modo: 'POS', motivo: null, faltan: [] },
  debe_facturar: { facturar: false, motivo: 'SIN_FEATURE' },
  feature: false,
  alertas: [],
  ...extra,
});

/** La pantalla que la contiene decide si se pinta: aquí se reproduce esa decisión. */
@Component({
  standalone: true,
  imports: [FeOperacionComponent],
  template: `@if (esSuper()) { <app-fe-operacion [idNegocio]="idNegocio()" /> }`,
})
class Anfitrion {
  readonly esSuper = signal(false);
  readonly idNegocio = signal(17);
}

describe('FeOperacionComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getEmision: vi.fn(() => of(vista())),
      guardarEmision: vi.fn(() => of(vista())),
      probarConexion: vi.fn(),
      sincronizarRangos: vi.fn(),
      rangosDian: vi.fn(),
      crearRango: vi.fn(),
      usarRango: vi.fn(),
      cambiarEstadoEmision: vi.fn(() => of(vista())),
    };
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [{ provide: FacturacionService, useValue: api }],
    });
  });

  function montar(esSuper = true) {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.esSuper.set(esSuper);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const cmp = fixture.debugElement.children[0]?.componentInstance as FeOperacionComponent;
    return { fixture, el, cmp };
  }

  it('no existe —ni pide nada al servidor— para quien no es super admin', () => {
    const { el } = montar(false);
    expect(el.querySelector('app-fe-operacion')).toBeNull();
    expect(api['getEmision']).not.toHaveBeenCalled();
  });

  it('para el super admin carga la emisión del negocio y dice por qué no factura', () => {
    const { el } = montar();
    expect(api['getEmision']).toHaveBeenCalledWith(17);
    expect(el.textContent).toContain('Todavía no factura');
    expect(el.textContent).toContain('El plan del negocio no incluye');
  });

  it('nunca pinta credenciales guardadas: los campos nacen vacíos', () => {
    const { el } = montar();
    const campos = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="password"]'));
    expect(campos).toHaveLength(4);
    expect(campos.every((c) => c.value === '')).toBe(true);
    expect(el.textContent).toContain('Guardadas');
  });

  it('al guardar las credenciales las borra de la pantalla', () => {
    const { cmp } = montar();
    const credenciales = { client_id: 'a', client_secret: 'b', username: 'c', password: 'd' };
    cmp.credenciales.set(credenciales);
    cmp.guardarCredenciales();
    expect(api['guardarEmision']).toHaveBeenCalledWith(17, { credenciales, ambiente: 'PRUEBAS' });
    expect(cmp.credenciales()).toEqual({ client_id: '', client_secret: '', username: '', password: '' });
  });

  it('sin credenciales guardadas solo ofrece cargarlas', () => {
    api['getEmision'].mockReturnValue(of(vista({ config: null, rangos: [] })));
    const { el } = montar();
    expect(el.textContent).toContain('Guardar credenciales');
    expect(el.textContent).not.toContain('Probar la conexión');
    expect(el.textContent).not.toContain('Empezar a emitir');
  });

  it('activar pide confirmación antes de llamar al servidor', () => {
    const { cmp, fixture, el } = montar();
    cmp.porConfirmar.set('ACTIVO');
    fixture.detectChanges();
    expect(api['cambiarEstadoEmision']).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Sí, activar');
    cmp.confirmarEstado();
    expect(api['cambiarEstadoEmision']).toHaveBeenCalledWith(17, 'ACTIVO');
  });

  it('avisa si las credenciales son de otra empresa', () => {
    api['probarConexion'].mockReturnValue(
      of({ empresa: { nit: '900', dv: '1', razon_social: 'OTRA SAS' }, coincide_nit: false, nit_del_negocio: '800197268' }),
    );
    const { cmp, fixture, el } = montar();
    cmp.probar();
    fixture.detectChanges();
    expect(el.textContent).toContain('se facturaría a nombre de otra empresa');
  });

  it('enseña el motivo que da el servidor cuando algo falla', () => {
    api['cambiarEstadoEmision'].mockReturnValue(
      throwError(() => ({ error: { message: 'No se puede activar todavía. Falta: un rango de numeración en uso.' } })),
    );
    const { cmp, fixture, el } = montar();
    cmp.porConfirmar.set('ACTIVO');
    cmp.confirmarEstado();
    fixture.detectChanges();
    expect(el.textContent).toContain('Falta: un rango de numeración en uso');
  });

  it('cambiar de negocio recarga y olvida lo que se estaba escribiendo', () => {
    const { cmp, fixture } = montar();
    cmp.credenciales.set({ client_id: 'a', client_secret: 'b', username: 'c', password: 'd' });
    fixture.componentInstance.idNegocio.set(18);
    fixture.detectChanges();
    expect(api['getEmision']).toHaveBeenLastCalledWith(18);
    expect(cmp.credenciales().client_id).toBe('');
  });
});
