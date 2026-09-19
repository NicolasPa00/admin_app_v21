import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';

/**
 * Tests unitarios para LoginComponent.
 *
 * Reescritos contra los signals reales del componente: el login es por `numIdentificacion`
 * (EscalApp inicia sesión con el número de documento, no con email), y no hay un campo de
 * "tenant" en el formulario. La versión anterior probaba `component.email`/`emailError()` y un
 * input `#login-tenant` que no existen — deuda de un scaffold no actualizado.
 */
describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  describe('Validaciones de número de identificación', () => {
    it('debería mostrar error cuando está vacío', () => {
      component.numIdentificacion.set('');
      expect(component.numIdentificacionError()).toBe(
        'El número de identificación es obligatorio',
      );
    });

    it('debería no tener error con un valor no vacío', () => {
      component.numIdentificacion.set('1000000001');
      expect(component.numIdentificacionError()).toBeNull();
    });
  });

  describe('Validaciones de password', () => {
    it('debería mostrar error cuando la contraseña está vacía', () => {
      component.password.set('');
      expect(component.passwordError()).toBe('La contraseña es obligatoria');
    });

    it('debería mostrar error con contraseña menor a 8 caracteres', () => {
      component.password.set('short');
      expect(component.passwordError()).toBe('Mínimo 8 caracteres');
    });

    it('debería no tener error con contraseña válida', () => {
      component.password.set('validPassword123');
      expect(component.passwordError()).toBeNull();
    });
  });

  describe('formValid', () => {
    it('debería ser false cuando hay errores', () => {
      component.numIdentificacion.set('');
      component.password.set('');
      expect(component.formValid()).toBe(false);
    });

    it('debería ser true cuando todos los campos son válidos', () => {
      component.numIdentificacion.set('1000000001');
      component.password.set('validPassword123');
      expect(component.formValid()).toBe(true);
    });
  });

  describe('UI state', () => {
    it('debería iniciar sin errores de servidor', () => {
      expect(component.serverError()).toBeNull();
    });

    it('debería iniciar sin estar cargando', () => {
      expect(component.loading()).toBe(false);
    });

    it('debería iniciar con contraseña oculta', () => {
      expect(component.showPassword()).toBe(false);
    });
  });

  describe('Renderizado del template', () => {
    it('debería renderizar el título "Iniciar sesión"', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('.auth-card__title');
      expect(title?.textContent?.trim()).toBe('Iniciar sesión');
    });

    it('debería tener inputs de número de identificación y contraseña', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#login-num-id')).toBeTruthy();
      expect(compiled.querySelector('#login-password')).toBeTruthy();
    });

    it('debería tener labels con for asociados a inputs', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const labels = compiled.querySelectorAll('label');
      labels.forEach((label) => {
        if (label.htmlFor) {
          const input = compiled.querySelector(`#${label.htmlFor}`);
          expect(input).toBeTruthy();
        }
      });
    });
  });
});
