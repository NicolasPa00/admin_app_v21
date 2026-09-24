import { describe, it, expect } from 'vitest';

import { PlanDisponible } from '../../models/cobranza.models';
import { CODIGOS, agruparPlanes, familiaDe, opcionInicial } from './agrupar-planes';

/**
 * El agrupador que convierte las filas de `gener_plan` en las cuatro tarjetas del cliente.
 * Lo que se sostiene: se agrupa por CÓDIGO (nunca por nombre), un código desconocido no
 * desaparece, una tarjeta sin precios se oculta y el plan actual llega preseleccionado.
 */
describe('agruparPlanes', () => {
  let id = 0;
  const plan = (codigo: string | null, precio = 10000, nombre = `Plan ${codigo}`): PlanDisponible => ({
    id_plan: ++id,
    codigo,
    nombre,
    descripcion: null,
    precio,
    moneda: 'COP',
    ciclo: 'mensual',
  });

  /** Las 10 filas de la base de hoy, en desorden a propósito. */
  const catalogo = (): PlanDisponible[] => [
    plan('EMPRESARIAL_XL', 158999),
    plan('AVANZADO', 59999),
    plan('EMPRENDEDOR_FE_S', 66999),
    plan('BASICO', 27999),
    plan('EMPRESARIAL_S', 98999),
    plan('EMPRENDEDOR_FE_XL', 126999),
    plan('EMPRENDEDOR_FE_M', 86999),
    plan('EMPRENDEDOR_FE_L', 106999),
    plan('EMPRESARIAL_M', 118999),
    plan('EMPRESARIAL_L', 138999),
  ];

  it('diez filas se ven como CUATRO tarjetas, en el orden de la landing', () => {
    const { tarjetas, otros } = agruparPlanes(catalogo());

    expect(tarjetas.map((t) => t.id)).toEqual(['basico', 'avanzado', 'emprendedor-fe', 'empresarial']);
    expect(otros).toEqual([]);
  });

  it('Básico: una sola opción (BASICO), sin facturación', () => {
    const basico = agruparPlanes(catalogo()).tarjetas[0];

    expect(basico.opciones.map((o) => o.plan.codigo)).toEqual(['BASICO']);
    expect(basico.facturacion).toBe('no');
  });

  it('Emprendedor + Facturación: paquete obligatorio, S a XL (EMPRENDEDOR_FE_X)', () => {
    const emprendedor = agruparPlanes(catalogo()).tarjetas[2];

    expect(emprendedor.titulo).toBe('Emprendedor + Facturación');
    expect(emprendedor.facturacion).toBe('obligatoria');
    expect(emprendedor.opciones.map((o) => o.tramo)).toEqual(['S', 'M', 'L', 'XL']);
    expect(emprendedor.opciones.map((o) => o.plan.codigo)).toEqual([
      'EMPRENDEDOR_FE_S',
      'EMPRENDEDOR_FE_M',
      'EMPRENDEDOR_FE_L',
      'EMPRENDEDOR_FE_XL',
    ]);
  });

  it('Avanzado: una sola opción (AVANZADO), sin facturación', () => {
    const avanzado = agruparPlanes(catalogo()).tarjetas[1];

    expect(avanzado.opciones).toHaveLength(1);
    expect(avanzado.opciones[0].plan.codigo).toBe('AVANZADO');
    expect(avanzado.facturacion).toBe('no');
  });

  it('Empresarial: facturación obligatoria, solo S a XL', () => {
    const empresarial = agruparPlanes(catalogo()).tarjetas[3];

    expect(empresarial.facturacion).toBe('obligatoria');
    expect(empresarial.opciones.map((o) => o.tramo)).toEqual(['S', 'M', 'L', 'XL']);
  });

  it('el precio es el de la FILA real: no se calcula ni se suma nada', () => {
    const filas = catalogo();
    const { tarjetas } = agruparPlanes(filas);

    for (const t of tarjetas) {
      for (const o of t.opciones) {
        expect(o.plan).toBe(filas.find((f) => f.id_plan === o.plan.id_plan));
      }
    }
    expect(tarjetas[0].opciones[0].plan.precio).toBe(27999);
    expect(tarjetas[2].opciones[0].plan.precio).toBe(66999);
  });

  it('se agrupa por CÓDIGO, no por nombre: un nombre cambiado no mueve el plan', () => {
    const { tarjetas } = agruparPlanes([
      plan('BASICO', 27999, 'Plan Inicial renombrado'),
      plan('AVANZADO', 59999, 'Plan Básico'), // el nombre engaña; el código manda
    ]);

    expect(tarjetas.find((t) => t.id === 'basico')!.opciones[0].plan.nombre).toBe('Plan Inicial renombrado');
    expect(tarjetas.find((t) => t.id === 'avanzado')!.opciones[0].plan.nombre).toBe('Plan Básico');
  });

  it('un código DESCONOCIDO no desaparece: va a «otros»', () => {
    const nuevo = plan('PLAN_NUEVO_2027', 45000);
    const sinCodigo = plan(null, 12000);
    const { tarjetas, otros } = agruparPlanes([...catalogo(), nuevo, sinCodigo]);

    expect(otros).toEqual([nuevo, sinCodigo]);
    expect(tarjetas).toHaveLength(4);
  });

  it('un tramo sin precio para el negocio no aparece (solo llegan los planes con precio)', () => {
    const { tarjetas } = agruparPlanes([
      plan('BASICO'),
      plan('EMPRENDEDOR_FE_S'),
      plan('EMPRENDEDOR_FE_XL'),
    ]);

    expect(tarjetas.map((t) => t.id)).toEqual(['basico', 'emprendedor-fe']);
    expect(tarjetas[1].opciones.map((o) => o.tramo)).toEqual(['S', 'XL']);
  });

  it('una familia sin ninguna opción con precio NO aparece (p. ej. Chile: solo Básico y Avanzado)', () => {
    const { tarjetas } = agruparPlanes([plan('BASICO', 8900), plan('AVANZADO', 18900)]);

    expect(tarjetas.map((t) => t.id)).toEqual(['basico', 'avanzado']);
  });

  it('sin planes no hay tarjetas ni «otros»', () => {
    expect(agruparPlanes([])).toEqual({ tarjetas: [], otros: [] });
    expect(agruparPlanes(null)).toEqual({ tarjetas: [], otros: [] });
  });

  it('el mapeo cubre exactamente los 10 códigos del catálogo', () => {
    expect(Object.keys(CODIGOS).sort()).toEqual(
      catalogo().map((p) => p.codigo!).sort(),
    );
  });

  it('familiaDe dice a qué tarjeta pertenece un plan', () => {
    expect(familiaDe(plan('EMPRESARIAL_M'))).toBe('empresarial');
    expect(familiaDe(plan('DESCONOCIDO'))).toBeNull();
    expect(familiaDe(undefined)).toBeNull();
  });
});

describe('opcionInicial — qué combinación enseña cada tarjeta', () => {
  let id = 100;
  const plan = (codigo: string, precio: number): PlanDisponible => ({
    id_plan: ++id, codigo, nombre: codigo, descripcion: null, precio, moneda: 'COP', ciclo: 'mensual',
  });
  const filas = [
    plan('BASICO', 27999),
    plan('EMPRENDEDOR_FE_S', 66999),
    plan('EMPRENDEDOR_FE_M', 86999),
    plan('EMPRESARIAL_S', 98999),
    plan('EMPRESARIAL_M', 118999),
  ];
  const { tarjetas } = agruparPlanes(filas);
  const emprendedor = tarjetas[1];
  const empresarial = tarjetas[2];
  const idDe = (codigo: string) => filas.find((f) => f.codigo === codigo)!.id_plan;

  it('el plan ACTUAL viene preseleccionado, con su paquete', () => {
    // Plan actual EMPRENDEDOR_FE_M → tarjeta Emprendedor + Facturación con M preseleccionado.
    expect(emprendedor.id).toBe('emprendedor-fe');
    const o = opcionInicial(emprendedor, { idPlanMarcado: null, idPlanActual: idDe('EMPRENDEDOR_FE_M') });
    expect(o.plan.codigo).toBe('EMPRENDEDOR_FE_M');
    expect(o.tramo).toBe('M');
  });

  it('sin plan actual en la tarjeta, arranca en la primera opción (paquete S)', () => {
    expect(opcionInicial(emprendedor, { idPlanMarcado: null, idPlanActual: null }).plan.codigo).toBe(
      'EMPRENDEDOR_FE_S',
    );
    expect(
      opcionInicial(empresarial, { idPlanMarcado: null, idPlanActual: idDe('BASICO') }).plan.codigo,
    ).toBe('EMPRESARIAL_S');
  });

  it('el plan MARCADO manda sobre el actual y sobre lo tocado antes', () => {
    const o = opcionInicial(emprendedor, {
      idPlanMarcado: idDe('EMPRENDEDOR_FE_S'),
      idPlanActual: idDe('EMPRENDEDOR_FE_M'),
      tramoLocal: null,
    });
    expect(o.plan.codigo).toBe('EMPRENDEDOR_FE_S');
  });

  it('lo que el cliente tocó en una tarjeta sin elegirla manda sobre el plan actual', () => {
    const o = opcionInicial(emprendedor, {
      idPlanMarcado: idDe('EMPRESARIAL_S'), // el marcado es de OTRA tarjeta
      idPlanActual: idDe('EMPRENDEDOR_FE_M'),
      tramoLocal: 'S',
    });
    expect(o.plan.codigo).toBe('EMPRENDEDOR_FE_S');
  });
});
