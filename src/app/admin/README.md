# Admin Module — Guía de integración

## Estructura

```
src/app/admin/
├── data-access/
│   ├── admin.service.ts          ← fetch tipos-negocio + roles; opción mock dev
│   └── admin.service.spec.ts
├── features/
│   ├── admin-dashboard/
│   │   ├── admin-dashboard.component.ts
│   │   ├── admin-dashboard.component.html
│   │   ├── admin-dashboard.component.scss
│   │   └── admin-dashboard.component.spec.ts
│   └── negocio-card/
│       ├── negocio-card.component.ts
│       └── negocio-card.component.scss
├── guards/
│   ├── admin.guard.ts
│   └── admin.guard.spec.ts
├── models/
│   └── admin.models.ts
├── admin-routing.ts
└── README.md  (este archivo)
```

---

## 1. Integrar las rutas en la app

En [src/app/app.routes.ts](../app.routes.ts) agrega:

```typescript
import { adminRoutes } from './admin/admin-routing';

export const routes: Routes = [
  { path: 'auth',      children: authRoutes  },
  { path: 'admin',     children: adminRoutes },          // ← añadir
  { path: 'dashboard', children: adminRoutes },          // ← alias opcional
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth/login' },
];
```

Después del login exitoso, `AuthService.login()` navega a `/dashboard`.
Ajusta el redirect en [auth.service.ts](../auth/data-access/auth.service.ts):

```typescript
this.router.navigate(['/admin/dashboard']);
```

---

## 2. Endpoints del backend esperados

| Método | Ruta                          | Descripción                         |
|--------|-------------------------------|-------------------------------------|
| GET    | `/admin/tipos-negocio`        | Lista todos los tipos de negocio    |
| GET    | `/admin/roles`                | Lista todos los roles               |
| GET    | `/admin/tipos-negocio/:id/roles` | Roles de un tipo específico      |

Respuesta esperada (envoltorio estándar):
```json
{ "success": true, "message": "...", "data": [...] }
```

Si la ruta real difiere, actualiza `environment.apiUrl` y los paths en `AdminService`.

---

## 3. Activar/desactivar mock de datos

En [admin.service.ts](data-access/admin.service.ts):

```typescript
const USE_MOCK = true;  // desarrollo sin backend
const USE_MOCK = false; // producción — usa endpoints reales
```

Los datos mock incluyen 7 tipos de negocio y 11 roles de ejemplo.

---

## 4. Acceso según rol

| Rol                       | Acceso                                   |
|---------------------------|------------------------------------------|
| `SUPER ADMINISTRADOR`     | Todos los tipos de negocio               |
| `ADMINISTRADOR X` (tenant) | Solo los tipos cuyos roles coincidan   |
| Sin rol válido            | Redirigido a `/auth/login`               |

El guard `adminGuard()` evalúa `currentUser.roles_globales` y `currentUser.negocios[].roles`.

---

## 5. Pruebas rápidas (usuarios mock)

### Super Admin
```typescript
const superAdmin: User = {
  id_usuario: 1,
  primer_nombre: 'Nicolas', primer_apellido: 'Paez',
  email: 'admin@test.com',
  negocios: [],
  roles_globales: [{ id_rol: 1, descripcion: 'SUPER ADMINISTRADOR' }],
};
```
Resultado esperado: ve los 7 tipos de negocio.

### Admin de tenant (solo Restaurante)
```typescript
const tenantAdmin: User = {
  id_usuario: 2,
  primer_nombre: 'Juan', primer_apellido: 'López',
  email: 'juan@test.com',
  negocios: [{
    id_negocio: 1,
    nombre: 'Mi Restaurante',
    roles: [{ id_rol: 2, descripcion: 'ADMINISTRADOR RESTAURANTE' }],
  }],
  roles_globales: [],
};
```
Resultado esperado: ve solo la card "RESTAURANTE".

---

## 6. Dependencias

- **lucide-angular** — iconos SVG (`npm install lucide-angular`).  
  Ya instalado en el proyecto. Iconos usados: `utensils`, `car`, `scissors`,
  `shopping-cart`, `wrench`, `piggy-bank`, `landmark`, `building-2`,
  `check-circle-2`, `x-circle`, `users`, `arrow-right`, `calendar-days`,
  `refresh-cw`, `sun`, `moon`, `log-out`, `alert-circle`, `layout-grid`.

---

## 7. Navegación desde una card

El botón **"Entrar"** navega a `/dashboard/negocio/:tipoId`.  
Crea el componente de destino y agrégalo a las rutas; el placeholder actual
apunta al mismo `AdminDashboardComponent`.
