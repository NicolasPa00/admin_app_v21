import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

/**
 * Tests unitarios para ThemeService.
 *
 * El modo oscuro fue retirado del producto: la app usa un único tema claro.
 * El servicio solo debe fijar `data-theme="light"` en <html>.
 */
describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debería fijar data-theme="light" en el elemento <html>', () => {
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
