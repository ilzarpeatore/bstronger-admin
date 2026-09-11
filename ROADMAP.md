# Roadmap MightyFitness — Panel Admin + App Móvil

> Documento de planificación. Estado actual: el **panel admin** (Vite + React, este repo) ya tiene CRUD funcional de casi todos los módulos contra el backend **Laravel** (`fitness-backend`). La **app móvil** (Flutter, `mightyfitness_flutter`) está en fase inicial: solo auth, onboarding y una pantalla "game home".

Convenciones:
- [ ] = tarea por hacer
- **Panel**: cambios en este repo (Next.js admin panel).
- **Backend**: endpoints/datos que debe exponer Laravel (`fitness-backend`).
- **App**: cambios en la app Flutter de cliente (`mightyfitness_flutter`).

---

## 0. Prioridad técnica (deuda antes de features)

Pequeñas tareas que desbloquean el resto y reducen riesgo.

- [ ] **Panel** — Eliminar los PNG originales sin uso (`src/assets/images/blog/*.png`, `src/assets/images/profile/user-*.png`) tras la migración a WebP (~5 MB muertos en el repo).
- [ ] **Panel** — Decidir el rol de MSW en producción: hoy arranca en todos los entornos y enmascara cualquier error real de la API. Opción estándar: activarlo solo en `npm run dev` (`import.meta.env.DEV`).
- [ ] **Panel** — Pipeline CI básico: `npm run lint` + `npm run build` + `npm test` en cada PR (hoy solo se ejecutan en local).
- [ ] **App** — Definir la navegación base (bottom nav / drawer) y el flujo de login real contra `/admin/login` de Laravel (hoy solo hay pantallas estáticas).
- [ ] **Backend** — Documentar el listado de rutas `/admin/*` disponibles (OpenAPI o postman_collection) para que panel y app consuman lo mismo.

---

## 1. Analítica e informes

Objetivo: convertir el dashboard en fuente de decisión, con exportaciones.

### Panel
- [ ] Ampliar el dashboard actual (hoy: 4 tarjetas + 2 gráficas) con KPIs por período: altas/mes, retención, entrenamientos completados/mes, cumplimiento de dietas, check-ins enviados vs. respondidos.
- [ ] Comparativa entre períodos (semana/anterior, mes/anterior) con % de cambio.
- [ ] Página "Informes": rango de fechas + filtros (gimnasio, coach, programa) y botón **Exportar CSV/Excel** de cada tabla (usuarios, suscripciones, sesiones, pagos).
- [ ] Métricas de coaching: nº de clientes activos por coach, % de clientes con plan asignado, % de clientes que completan ≥80% de la semana.

### Backend
- [ ] Endpoints agregados: `/admin/reports/users-summary`, `/admin/reports/sessions`, `/admin/reports/checkins`, `/admin/reports/subscriptions` (aceptan `from`/`to`/`group_by`).
- [ ] Endpoint de exportación (`/admin/reports/export?format=csv`).

### App
- [ ] (Fase posterior) Progreso semanal del cliente y "rachas", retroalimentando las métricas del panel.

---

## 2. Comercial (suscripciones y paquetes)

Objetivo: cerrar el ciclo de vida de la suscripción sin salir del panel.

### Panel
- [ ] Vista de **suscripciones activas** con fecha de renovación, estado y aviso visual de "próxima a vencer" (≤7 días).
- [ ] Recordatorios de renovación: botón "Enviar aviso" (push/email) por suscripción o en lote.
- [ ] Acción rápida "Desactivar cliente" al vencer: revocar acceso (is_personal_client/free) desde la misma fila.
- [ ] Tarjetas de métricas: MRR, ARPU, suscripciones activas/vencidas, cancelaciones del mes.
- [ ] CRUD de **paquetes** (duración, precio, características) ya existente → añadir "activo/archivado" y orden de venta.

### Backend
- [ ] `POST /admin/subscription/reminder` (dispara push/email).
- [ ] `POST /admin/users/{id}/revoke-access` (marca vencido y desactiva).
- [ ] Endpoint de métricas comerciales `/admin/subscriptions/stats`.

### App
- [ ] Pantalla de **plan/suscripción actual** del cliente: fecha de vencimiento, aviso de renovación, estado.
- [ ] Deep link desde push "Tu suscripción vence en 3 días" → pantalla de plan.

---

## 3. Coaching y programación

Objetivo: que el coach arme programas desde el panel y el cliente los vea y complete en la app.

### Panel
- [ ] **Asignación masiva**: marcar N clientes y asignar el mismo programa/dieta en una acción (hoy es 1 a 1 en `UserDetail`).
- [ ] Vista "Plan semanal del cliente": calendario consolidado (entrenamientos + comidas + check-ins) con estado día a día.
- [ ] Drag & drop para mover un workout dentro del calendario de un cliente (hoy se abre el preview y se edita por id).
- [ ] Feedback de sesión: respuesta del cliente visible en el panel (ya existe `SessionDetail`; falta el badge de pendiente/leído).
- [ ] Plantillas: duplicar programa de entrenamiento / plantilla de comidas con "cambiar fechas".

### Backend
- [ ] Endpoint de asignación masiva `POST /admin/assign-bulk`.
- [ ] Validación de solapamientos de asignaciones (mismo día/horario).

### App
- [ ] **Pantallas core del cliente**: calendario semanal (entrenamientos y comidas), detalle de entrenamiento con ejercicio + peso/reps + marcar completado, detalle de comida del día.
- [ ] Check-in de sesión (enviar feedback al coach) → visible en el panel.
- [ ] Historial de progreso personal (peso, 1RM, fotos) consumiendo `/admin/exercise-history` por cliente.

---

## 4. Contenido y notificaciones

Objetivo: comunicar con los clientes desde el panel y mantener el contenido por idioma.

### Panel
- [ ] **Push notifications** (pantalla ya existente): previsualización en dispositivo, segmentación (todos / por idioma / por tipo de cliente) y programación con fecha.
- [ ] Historial de envíos con métricas básicas (entregadas/abiertas).
- [ ] Gestión de **banners** (ya existe CRUD): añadir vigencia por fechas y posición (home, gym, game).
- [ ] **Traducciones** (ya existen Languages/Keywords): bandeja de strings pendientes de traducir y export/import de idioma (JSON/CSV).

### Backend
- [ ] Integración FCM/APNs para push (`/admin/notifications/send`, `segment`).
- [ ] Modelo de "traducciones pendientes" (clave + idiomas faltantes).

### App
- [ ] Registro del dispositivo para push (FCM token al hacer login).
- [ ] Pantalla de **notificaciones** (bandeja) con estado leído.
- [ ] Aplicación real de los banners activos y de los textos traducidos (`languageConfiguration` ya existe como base).

---

## 5. Seguridad y roles

Objetivo: control de acceso y trazabilidad para el equipo del gym.

### Panel
- [ ] **Sub-admins** (ya existe CRUD): limitar por módulos y por acciones (ver/crear/editar/eliminar) usando los permisos ya definidos.
- [ ] **Audit log**: registrar acciones sensibles (login, logout, alta/baja de cliente, cambios de suscripción, cambios de permisos) con fecha, usuario y detalle. Pantalla de consulta con filtros.
- [ ] **2FA** para el panel: TOTP opcional por usuario, con QR de setup y códigos de respaldo.
- [ ] `LoginHistory`/`LoginDevices` (ya existen): añadir bloqueo remoto de sesión/device.

### Backend
- [ ] Middleware de auditoría (`audit_logs` table + writer).
- [ ] Endpoints TOTP: `/admin/2fa/setup`, `/admin/2fa/verify`, `/admin/2fa/disable`.
- [ ] Endpoint de revocación de device/sesión.

### App
- [ ] (Si aplica al cliente) autenticación con refresh token y logout seguro en todos los dispositivos.

---

## 6. Otras mejoras transversales

- [ ] **Panel** — Modo oscuro/claro ya funciona; unificar toasts y estados vacíos (en curso, en es-ES).
- [ ] **Panel** — Página de "tareas" ya existente: añadir asignación de tareas internas entre sub-admins con aviso.
- [ ] **App** — Onboarding (ya existe pantalla): conectar a `/admin/me` y adaptar el contenido según el plan del cliente.
- [ ] **App** — Game: definir qué datos del entrenamiento alimentan el "game home" (retos, puntos, rachas) desde `/admin/challenges` y `/admin/habits`.

---

## Orden sugerido de ejecución

1. **Sección 0** (deuda técnica) — todo son tareas pequeñas y de bajo riesgo.
2. **Sección 5** (seguridad) — audit log + 2FA protegen el resto del trabajo.
3. **Sección 3** (coaching) — es lo que más valor aporta al cliente final y depende del CRUD que ya existe.
4. **Sección 2 y 4** (comercial + contenido) — generan ingresos/engagement.
5. **Sección 1** (analítica) — se construye sobre datos que las secciones 2-4 ya generan.

Cada sección debe tratarse como una unidad: primero **Backend**, luego **Panel**, y finalmente **App** (la app consume lo que panel y backend ya exponen).
