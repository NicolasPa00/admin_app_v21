import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { ThemeService, ThemeMode } from './theme.service';

/**
 * Tests unitarios para ThemeService.
 *
 * Verifican:
 *  • initTheme aplica tema correcto según localStorage o preferencia del sistema.
 *  • toggleTheme cambia el tema y persiste en localStorage.
 *  • data-theme en <html> coincide con la signal resolvedTheme.
 *  • setTheme('system') sigue la preferencia del sistema.
 */
describe('ThemeService', () => {
  let service: ThemeService;

  // Mock de matchMedia
  const matchMediaMock = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  beforeEach(() => {
    // Limpiar localStorage
    localStorage.clear();

    // Mock de window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debería iniciar con tema "system" por defecto', () => {
    expect(service.theme()).toBe('system');
  });

  it('debería resolver tema "light" cuando el sistema prefiere light', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    // Re-crear servicio para aplicar el mock
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(ThemeService);

    expect(freshService.resolvedTheme()).toBe('light');
  });

  it('debería persistir tema en localStorage con setTheme()', () => {
    service.setTheme('dark');
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(service.theme()).toBe('dark');
  });

  it('debería alternar tema con toggleTheme()', () => {
    // Empieza en 'system' → resolved 'light' (mock matches: false)
    service.toggleTheme();
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('app_theme')).toBe('dark');

    service.toggleTheme();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('app_theme')).toBe('light');
  });

  it('debería leer tema de localStorage en initTheme()', () => {
    localStorage.setItem('app_theme', 'dark');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(ThemeService);

    expect(freshService.theme()).toBe('dark');
    expect(freshService.resolvedTheme()).toBe('dark');
  });

  it('debería aplicar data-theme en el elemento <html>', () => {
    service.setTheme('dark');
    // El effect se ejecuta sincrónicamente en el siguiente tick de Angular
    // pero en tests con TestBed, podemos verificar el atributo directamente
    TestBed.flushEffects();
    const dataTheme = document.documentElement.getAttribute('data-theme');
    expect(dataTheme).toBe('dark');
  });

  it('prefersSystem() debería retornar true cuando tema es "system"', () => {
    service.setTheme('system');
    expect(service.prefersSystem()).toBe(true);

    service.setTheme('dark');
    expect(service.prefersSystem()).toBe(false);
  });
});
