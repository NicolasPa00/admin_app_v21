import { describe, expect, it } from 'vitest';

import {
  ICONOS_AYUDA,
  ICONO_POR_DEFECTO,
  NOMBRES_ICONOS,
  aPascalCaseParaTests as aPascalCase,
  iconoSeguro,
} from './ayuda-iconos';

/**
 * El centinela de los iconos del Centro de ayuda.
 *
 * `ayuda_modulo.icono` guarda un nombre en kebab-case que viene de la base de datos, y
 * `lucide-angular` solo pinta lo que esté en su proveedor — un nombre no registrado no da error,
 * deja un hueco. Así que las dos listas (la de componentes y la que ofrece el panel) tienen que
 * corresponderse exactamente, y eso es lo que se comprueba aquí.
 */
describe('iconos del centro de ayuda', () => {
  it('convierte kebab a PascalCase como lo hace lucide, incluidos los nombres con dígitos', () => {
    // Estos cuatro son los que rompieron la derivación en sentido contrario.
    expect(aPascalCase('bar-chart-3')).toBe('BarChart3');
    expect(aPascalCase('grid-3x3')).toBe('Grid3x3');
    expect(aPascalCase('loader-2')).toBe('Loader2');
    expect(aPascalCase('building-2')).toBe('Building2');
    expect(aPascalCase('book-open')).toBe('BookOpen');
    expect(aPascalCase('home')).toBe('Home');
  });

  it('cada nombre ofrecido por el panel está registrado como componente', () => {
    const sinRegistrar = NOMBRES_ICONOS.filter((n) => !(aPascalCase(n) in ICONOS_AYUDA));
    expect(sinRegistrar).toEqual([]);
  });

  it('cada componente registrado se puede elegir en el panel', () => {
    const registrados = new Set(NOMBRES_ICONOS.map((n) => aPascalCase(n)));
    const sinOfrecer = Object.keys(ICONOS_AYUDA).filter((k) => !registrados.has(k));
    expect(sinOfrecer).toEqual([]);
  });

  it('un icono desconocido o ausente cae en el de por defecto', () => {
    expect(iconoSeguro('no-existe-este-icono')).toBe(ICONO_POR_DEFECTO);
    expect(iconoSeguro(null)).toBe(ICONO_POR_DEFECTO);
    expect(iconoSeguro('')).toBe(ICONO_POR_DEFECTO);
  });

  it('un icono conocido se devuelve tal cual', () => {
    expect(iconoSeguro('book-open')).toBe('book-open');
    expect(iconoSeguro('bar-chart-3')).toBe('bar-chart-3');
    expect(iconoSeguro('grid-3x3')).toBe('grid-3x3');
  });

  it('el icono por defecto es uno de los registrados', () => {
    expect(NOMBRES_ICONOS).toContain(ICONO_POR_DEFECTO);
  });
});
