# Auth Module — Documentación de Integración

## Descripción

Módulo de autenticación frontend para la Admin App multiempresarial (restaurante).  
Implementado con **Angular 21** (standalone components, Signals, zoneless-ready).

---

## Estructura de archivos

```
src/app/auth/
├── models/
│   └── auth.models.ts          # Interfaces: User, LoginRequest, etc.
├── data-access/
│   ├── auth.service.ts          # Servicio principal de autenticación
│   └── auth.service.spec.ts     # Tests unitarios
├── interceptors/
│   ├── auth.interceptor.ts      # Interceptor HTTP (token + refresh)
│   └── auth.interceptor.spec.ts
├── guards/
│   └── auth.guard.ts            # Guard funcional con soporte de roles
├── features/
│   ├── login/                   # Componente de login
│   ├── register/                # Componente de registro
│   ├── forgot-password/         # Solicitar recuperación de contraseña
│   └── reset-password/          # Restablecer contraseña con token
├── auth-routing.ts              # Rutas lazy-loaded del módulo
└── README.md                    # Este archivo

src/app/core/theme/
├── theme.service.ts             # Servicio de temas (claro/oscuro/sistema)
└── theme.service.spec.ts

src/styles/
└── _theme.scss                  # Design tokens CSS + helpers globales

src/environments/
├── environment.ts               # Config desarrollo
└── environment.prod.ts          # Config producción
```

---

## Configuración del backend

### Variable `environment.apiUrl`

Edita `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1', // ← Ajusta al host de tu backend
  defaultTenantId: 'restaurant-dev',
};
```

### Endpoints esperados

| Método | Endpoint                      | Body                                    | Respuesta                             |
|--------|-------------------------------|-----------------------------------------|---------------------------------------|
| POST   | `/auth/login`                 | `{ email, password, tenantId? }`        | `{ accessToken, user }`               |
| POST   | `/auth/register`              | `{ name, email, password, tenantId, role? }` | `{ user, accessToken }`          |
| POST   | `/auth/forgot-password`       | `{ email, tenantId? }`                  | `{ ok: true }`                        |
| POST   | `/auth/reset-password`        | `{ token, newPassword }`                | `{ ok: true }`                        |
| GET    | `/auth/me`                    | — (Bearer token en header)              | `{ user }`                            |
| POST   | `/auth/refresh`               | — (cookie HttpOnly o body)              | `{ accessToken }`                     |
| GET    | `/auth/check-email?email=...` | —                                       | `{ available: boolean }`              |

> **Nota sobre `/auth/check-email`:** Este endpoint puede no existir aún en el backend.  
> Si no está implementado, la validación async en el registro simplemente se ignorará  
> (catch devuelve `null`). Puedes implementarlo en el backend o eliminarlo del componente.

---

## Manejo de tokens — Cookies vs localStorage

### Opción 1: Cookie HttpOnly (RECOMENDADO ✅)

El backend envía el `refreshToken` como cookie `HttpOnly`, `Secure`, `SameSite=Strict`.  
El frontend solo guarda el `accessToken` en memoria (signal).

**Backend debe:**
1. En `/auth/login` y `/auth/register`: setear cookie con refreshToken.
2. En `/auth/refresh`: leer la cookie, validar y devolver nuevo accessToken.
3. CORS: permitir `credentials: true` desde el origen del frontend.

**Frontend (ya configurado):**
- `withCredentials: true` en todas las peticiones que necesitan la cookie.
- `accessToken` se pierde al recargar → el interceptor llama a `/auth/refresh` automáticamente.

### Opción 2: refreshToken en localStorage (alternativa ⚠️)

Si el backend **no puede** setear cookies HttpOnly (ej: arquitectura serverless sin control de cookies):

1. El backend devuelve `refreshToken` en el body de `/auth/login` y `/auth/register`.
2. Modifica `AuthService.login()` para guardar el refresh en localStorage:

```typescript
// En auth.service.ts → login()
tap((res) => {
  this._accessToken.set(res.accessToken);
  this.currentUser.set(res.user);
  // ⚠️ Menos seguro — vulnerable a XSS
  if (res.refreshToken) {
    localStorage.setItem('app_refresh_token', res.refreshToken);
  }
})
```

3. Modifica `refreshAccessToken$()` para enviar el token en el body:

```typescript
refreshAccessToken$(): Observable<string> {
  const refreshToken = localStorage.getItem('app_refresh_token');
  return this.http.post<RefreshResponse>(
    `${this.API}/auth/refresh`,
    { refreshToken },  // ← Enviar en body
  ).pipe(/* ... */);
}
```

> ⚠️ **Advertencia de seguridad:** Guardar refreshToken en localStorage lo expone a ataques XSS.  
> Usa esta opción solo si no hay otra alternativa.

---

## Tema claro/oscuro

### ThemeService

- **Signal `theme`**: `'light' | 'dark' | 'system'`
- **Computed `resolvedTheme`**: siempre `'light'` o `'dark'`
- **Persistencia**: `localStorage` con clave `app_theme`
- **Atributo DOM**: `data-theme="light|dark"` en `<html>`

### Tokens CSS

Definidos en `src/styles/_theme.scss`:

```scss
// Uso en cualquier componente:
.mi-componente {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}
```

Tokens disponibles: `--color-primary`, `--color-on-primary`, `--color-bg`, `--color-surface`,  
`--color-surface-elevated`, `--color-text-primary`, `--color-text-secondary`, `--color-border`,  
`--color-success`, `--color-error`, `--color-focus`, `--shadow-elevated`, `--focus-ring`,  
`--spacing-xs..2xl`, `--radius-sm..full`, `--font-size-xs..2xl`, `--transition-fast/normal`.

### Toggle en componentes

```typescript
import { ThemeService } from '@app/core/theme/theme.service';

readonly themeService = inject(ThemeService);
// En template: (click)="themeService.toggleTheme()"
```

---

## Testing rápido

### Ejecutar tests

```bash
cd admin_app-v21
npm test
```

Los tests usan **Vitest** con Angular TestBed (`@angular/build:unit-test`).

### Tests incluidos

| Archivo                              | Qué verifica                                        |
|--------------------------------------|-----------------------------------------------------|
| `auth.service.spec.ts`              | Login, logout, register, refresh, estado de signals |
| `login.component.spec.ts`           | Validaciones, renderizado, accesibilidad            |
| `auth.interceptor.spec.ts`          | Header Authorization, refresh en 401                |
| `theme.service.spec.ts`             | Persistencia, toggle, data-theme en DOM             |

### Mock de backend para desarrollo

Si no tienes backend disponible, puedes usar un mock con `json-server` o un interceptor mock:

```bash
# Instalar json-server
npm install -D json-server

# Crear db.json con datos de prueba
echo '{ "auth": {} }' > db.json

# Ejecutar
npx json-server db.json --port 3000
```

O crea un interceptor mock para desarrollo:

```typescript
// src/app/auth/interceptors/auth-mock.interceptor.ts
export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/auth/login')) {
    return of(new HttpResponse({
      status: 200,
      body: {
        accessToken: 'mock-token',
        user: { id: '1', name: 'Dev User', email: 'dev@test.com', roles: ['admin'], tenantId: 'dev' }
      }
    }));
  }
  return next(req);
};
```

---

## Guard de rutas — Uso

```typescript
import { authGuard } from '@app/auth/guards/auth.guard';

// Cualquier usuario autenticado
{ path: 'dashboard', canActivate: [authGuard()], component: DashboardComponent }

// Solo admin o manager
{ path: 'settings', canActivate: [authGuard(['admin', 'manager'])], component: SettingsComponent }
```

---

## Accesibilidad

- Todos los inputs tienen `<label>` con `for` asociado.
- `aria-invalid="true"` cuando hay error de validación.
- `aria-describedby` apunta al mensaje de error.
- `role="alert"` en mensajes de error y éxito.
- Focus visible con outline personalizado.
- `prefers-reduced-motion: reduce` desactiva animaciones.

---

## Checklist de integración

- [ ] Configurar `environment.apiUrl` apuntando al backend.
- [ ] Verificar que el backend soporta CORS con `credentials: true`.
- [ ] Decidir estrategia de refreshToken (cookies vs localStorage).
- [ ] Implementar endpoint `/auth/check-email` o eliminar validación async.
- [ ] Crear ruta `/dashboard` para la redirección post-login.
- [ ] Añadir más roles y ajustar guards según necesidades.
