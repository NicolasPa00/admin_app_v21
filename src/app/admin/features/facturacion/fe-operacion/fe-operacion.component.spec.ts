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
      registrarRango: vi.fn(() => of([])),
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
    expect(api['guardarEmision']).toHaveBeenCalledWith(17, { proveedor: 'FACTUS', credenciales, ambiente: 'PRUEBAS' });
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

  describe('emisor propio (DIAN_DIRECTO)', () => {
    const propia = () => {
      const v = vista();
      return { ...v, config: { ...v.config!, proveedor: 'DIAN_DIRECTO' as const }, rangos: [] };
    };

    it('elegirlo cambia el formulario: certificado, clave, identificador del software y PIN', () => {
      api['getEmision'].mockReturnValue(of(vista({ config: null, rangos: [] })));
      const { cmp, fixture, el } = montar();
      cmp.proveedorElegido.set('DIAN_DIRECTO');
      fixture.detectChanges();
      expect(el.querySelector('input[type="file"]')).not.toBeNull();
      expect(el.textContent).toContain('Identificador del software');
      expect(el.textContent).not.toContain('Client secret');
    });

    it('guarda el proveedor con sus credenciales y las borra de la pantalla', () => {
      api['getEmision'].mockReturnValue(of(vista({ config: null, rangos: [] })));
      const { cmp } = montar();
      cmp.proveedorElegido.set('DIAN_DIRECTO');
      const credenciales = { certificado_p12: 'TUlJ', clave_certificado: 'c', software_id: 's', pin: '1' };
      cmp.credencialesPropio.set(credenciales);
      expect(cmp.credencialesCompletas()).toBe(true);
      cmp.guardarCredenciales();
      expect(api['guardarEmision']).toHaveBeenCalledWith(17, { proveedor: 'DIAN_DIRECTO', credenciales, ambiente: 'PRUEBAS' });
      expect(cmp.credencialesPropio().certificado_p12).toBe('');
    });

    it('avisa antes de cambiar de emisor a un negocio que ya tiene credenciales del otro', () => {
      const { cmp, fixture, el } = montar(); // guardado: FACTUS con credenciales
      cmp.proveedorElegido.set('DIAN_DIRECTO');
      fixture.detectChanges();
      expect(el.textContent).toContain('las anteriores se borran');
      expect(el.textContent).toContain('Guardar y cambiar de emisor');
    });

    it('registra el rango de la DIAN con su clave técnica; sin clave no deja', () => {
      api['getEmision'].mockReturnValue(of(propia()));
      const { cmp, fixture, el } = montar();
      expect(el.textContent).toContain('EscalApp lleva el consecutivo');
      cmp.registro.set({
        tipo: 'FV', prefijo: 'setp', desde: '990000000', hasta: '995000000', resolucion: '18760000001',
        clave: '', vigenciaDesde: '2019-01-19', vigenciaHasta: '2030-01-19',
      });
      expect(cmp.registroValido()).toBe(false);
      cmp.campoRegistro('clave', 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c');
      expect(cmp.registroValido()).toBe(true);
      cmp.registrarRango();
      fixture.detectChanges();
      expect(api['registrarRango']).toHaveBeenCalledWith(17, {
        tipo_documento: 'FV', prefijo: 'SETP', desde: 990000000, hasta: 995000000, resolucion: '18760000001',
        clave_tecnica: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c', vigencia_desde: '2019-01-19', vigencia_hasta: '2030-01-19',
      });
    });

    it('el rango de notas crédito no pide resolución ni clave técnica', () => {
      api['getEmision'].mockReturnValue(of(propia()));
      const { cmp } = montar();
      cmp.registro.set({ tipo: 'NC', prefijo: 'NC', desde: '1', hasta: '99999', resolucion: '', clave: '', vigenciaDesde: '', vigenciaHasta: '' });
      expect(cmp.registroValido()).toBe(true);
    });

    it('el rango del tiquete POS pide su resolución pero no clave técnica', () => {
      api['getEmision'].mockReturnValue(of(propia()));
      const { cmp } = montar();
      cmp.registro.set({ tipo: 'POS', prefijo: 'epos', desde: '1', hasta: '100000', resolucion: '', clave: '', vigenciaDesde: '', vigenciaHasta: '' });
      expect(cmp.registroValido()).toBe(false);
      cmp.campoRegistro('resolucion', '18764000000010');
      expect(cmp.registroValido()).toBe(true);
      cmp.registrarRango();
      expect(api['registrarRango']).toHaveBeenCalledWith(17, expect.objectContaining({
        tipo_documento: 'POS', prefijo: 'EPOS', resolucion: '18764000000010', clave_tecnica: null,
      }));
    });

    describe('tiquete POS electrónico', () => {
      const conPos = (enUso: boolean, softwarePos = enUso) => {
        const v = propia();
        return {
          ...v,
          config: v.config && {
            ...v.config,
            software_pos: softwarePos ? { software_id: '2e4e893d-1926-40f7-b706-80b4a5ac8613', pin_propio: false } : null,
          },
          rangos: [{
            id_resolucion: 'r-pos', id_rango_proveedor: null, tipo_documento: 'POS' as const, prefijo: 'EPOS',
            numero_resolucion: '18764000000010', rango_desde: 1, rango_hasta: 100000, consecutivo_actual: null,
            vigencia_hasta: '2028-01-01', vencida: false, en_uso: enUso,
          }],
        };
      };

      it('no deja encenderlo sin un rango POS en uso, sin su software ni sin los datos de la caja', async () => {
        api['getEmision'].mockReturnValue(of(conPos(false)));
        const { el, fixture } = montar();
        // ngModel aplica [disabled] en el siguiente ciclo.
        await fixture.whenStable();
        fixture.detectChanges();
        const pos = el.querySelector('input[name="feo-pos"]') as HTMLInputElement;
        expect(pos.disabled).toBe(true);
        expect(el.textContent).toContain(
          'un rango «Tiquete POS» en uso, el Software ID del tiquete POS y completar los datos de la caja',
        );
      });

      it('guarda el Software ID del POS aparte, sin pedir otra vez el certificado', () => {
        api['getEmision'].mockReturnValue(of(conPos(true, false)));
        const { cmp } = montar();
        expect(cmp.haySoftwarePos()).toBe(false);
        cmp.softwarePosId.set('  2e4e893d-1926-40f7-b706-80b4a5ac8613 ');
        cmp.guardarSoftwarePos();
        expect(api['guardarEmision']).toHaveBeenCalledWith(17, {
          software_pos: { software_id: '2e4e893d-1926-40f7-b706-80b4a5ac8613', pin: '' },
        });
      });

      it('con el software guardado lo enseña, pero nunca el PIN', () => {
        api['getEmision'].mockReturnValue(of(conPos(true)));
        const { cmp } = montar();
        expect(cmp.softwarePosId()).toBe('2e4e893d-1926-40f7-b706-80b4a5ac8613');
        expect(cmp.softwarePosPin()).toBe('');
      });

      it('con el rango y la caja, lo enciende mandando la caja escrita', async () => {
        api['getEmision'].mockReturnValue(of(conPos(true)));
        const { cmp, fixture, el } = montar();
        cmp.campoCaja('placa', 'CAJA-01');
        cmp.campoCaja('ubicacion', 'Mostrador');
        cmp.campoCaja('tipo', 'Caja registradora');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect((el.querySelector('input[name="feo-pos"]') as HTMLInputElement).disabled).toBe(false);
        cmp.guardarEmitePos(true);
        expect(api['guardarEmision']).toHaveBeenCalledWith(17, {
          emite_pos: true,
          pos_caja: { placa: 'CAJA-01', ubicacion: 'Mostrador', tipo: 'Caja registradora' },
        });
      });

      it('con Factus no aparece', () => {
        const { el } = montar();
        expect(el.querySelector('input[name="feo-pos"]')).toBeNull();
      });
    });
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
