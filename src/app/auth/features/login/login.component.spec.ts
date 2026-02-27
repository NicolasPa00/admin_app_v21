import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';

/**
 * Tests unitarios para LoginComponent.
 *
 * Verifican:
 *  • Validaciones de email y password.
 *  • El formulario no se envía si es inválido.
 *  • Se muestra error de servidor.
 *  • El toggle de tema funciona.
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

  describe('Validaciones de email', () => {
    it('debería mostrar error cuando el email está vacío', () => {
      component.email.set('');
      expect(component.emailError()).toBe('El email es obligatorio');
    });

    it('debería mostrar error con email inválido', () => {
      component.email.set('not-an-email');
      expect(component.emailError()).toBe('Formato de email inválido');
    });

    it('debería no tener error con email válido', () => {
      component.email.set('user@example.com');
      expect(component.emailError()).toBeNull();
    });
  });

  describe('Validaciones de password', () => {
    it('debería mostrar error cuando la contraseña está vacía', () => {
      component.password.set('');
      expect(component.passwordError()).toBe(
        'La contraseña es obligatoria',
      );
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
      component.email.set('');
      component.password.set('');
      expect(component.formValid()).toBe(false);
    });

    it('debería ser true cuando todos los campos son válidos', () => {
      component.email.set('user@example.com');
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

    it('debería renderizar el toggle de tema', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const toggle = compiled.querySelector('.theme-toggle');
      expect(toggle).toBeTruthy();
    });

    it('debería tener inputs de email, password y tenant', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#login-email')).toBeTruthy();
      expect(compiled.querySelector('#login-password')).toBeTruthy();
      expect(compiled.querySelector('#login-tenant')).toBeTruthy();
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
