# GitHub Repo Manager

Aplicación web local para consultar, crear y analizar repositorios reales de GitHub mediante la API REST y el cliente oficial Octokit. El sistema genera recomendaciones deterministas a partir de archivos y metadatos comprobables; ninguna recomendación modifica un repositorio hasta que el usuario revisa una vista previa y confirma expresamente la operación.

> Proyecto académico para la actividad SENA ADSO **“Dominando la API de GitHub: Autenticación, Consumo y Buenas Prácticas”**.

## 1. Descripción y alcance

GitHub Repo Manager integra en una interfaz React los ejercicios centrales del tutorial: autenticación con PAT, consultas `GET`, creación mediante `POST`, paginación, manejo del Rate Limit y consumo con Octokit. El MVP amplía el tutorial con un analizador de repositorios y un flujo seguro de cambios para `README.md`, `.gitignore` y la descripción.

La versión actual es para una sola persona y se ejecuta únicamente en el equipo local. No contiene base de datos, servicios de IA, OAuth ni despliegue público.

## 2. Objetivos

### Objetivo general

Desarrollar una aplicación web que demuestre el consumo seguro y verificable de GitHub REST API mediante React, Express y Octokit.

### Objetivos específicos

- Autenticar un PAT almacenado exclusivamente en el backend.
- Consultar repositorios e issues reales con paginación.
- Crear repositorios e issues únicamente después de una confirmación.
- analizar estructura, documentación y configuración pública disponible.
- generar recomendaciones mediante reglas deterministas y explicables.
- previsualizar diferencias y verificar el SHA antes de modificar archivos.
- presentar el Rate Limit real y mensajes diferenciados para errores HTTP.

## 3. Relación con el tutorial del instructor

| Tema del tutorial | Implementación |
|---|---|
| API REST de GitHub | Rutas Express que consumen endpoints oficiales |
| PAT | `GITHUB_TOKEN` leído por `dotenv` en el servidor |
| Rate Limiting | `octokit.rest.rateLimit.get()`; no se fija un valor constante |
| JavaScript y Node.js | Backend ESM con Node.js |
| Octokit | Cliente oficial centralizado en `server/src/config/github.js` |
| Consulta de repositorios | `repos.listForAuthenticatedUser` con `octokit.paginate()` |
| Consulta de issues | `issues.listForRepo`; se excluyen elementos `pull_request` |
| Solicitudes POST | Creación confirmada de repositorios e issues |
| Vite | Cliente React servido y construido con Vite |
| Credenciales | Token fuera del navegador, de Git y de respuestas HTTP |

## 4. Tecnologías

- React 19 y Vite 7.
- Node.js 20 o superior y Express 5.
- JavaScript ESM.
- Octokit 5.
- Zod para validar parámetros, consultas y cuerpos.
- Helmet, CORS y limitador local de solicitudes.
- CSS responsivo sin framework visual.
- Pruebas unitarias con `node:test` y rutas con Supertest.

El entorno diagnosticado durante la creación fue Node.js `v24.19.0`, npm `11.17.0` y Git `2.54.0.windows.1`.

## 5. Arquitectura

```text
Navegador
   │  X-Repo-Manager: local-client
   ▼
React + Vite (127.0.0.1:5173)
   │  /api (proxy en desarrollo)
   ▼
Express (127.0.0.1:3001)
   │  PAT solo en memoria del servidor
   ▼
Octokit
   │
   ▼
GitHub REST API
```

Express se enlaza explícitamente a `127.0.0.1`, acepta solamente los orígenes locales configurados y exige una cabecera de cliente en las rutas distintas de salud. Estas medidas reducen exposición accidental, pero no sustituyen OAuth/GitHub App si se publica la aplicación.

## 6. Estructura de carpetas

```text
github-repo-manager/
├── client/
│   ├── src/
│   │   ├── components/       # Layout, modales, selector y estados
│   │   ├── hooks/            # Estado asíncrono reutilizable
│   │   ├── pages/            # Dashboard, repos, creación, análisis, issues
│   │   ├── services/         # Cliente HTTP; nunca conoce el PAT
│   │   ├── styles/           # Identidad visual y diseño responsivo
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── config/           # Entorno y Octokit
│   │   ├── controllers/      # Adaptación HTTP
│   │   ├── middlewares/      # Validación, acceso local y errores
│   │   ├── routes/           # Contrato de la API local
│   │   ├── services/         # GitHub, analizador y acciones confirmadas
│   │   ├── validators/       # Esquemas Zod
│   │   ├── app.js
│   │   └── index.js
│   ├── test/
│   └── package.json
├── docs/GUIA_DEMOSTRACION.md
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 7. Requisitos previos

- Windows 10/11.
- Node.js 20.19 o superior (Vite 7 requiere una versión reciente).
- npm.
- Cuenta de GitHub.
- PAT de acceso específico con vencimiento y solo los repositorios necesarios.
- Un repositorio de prueba para las evidencias de escritura.

### Permisos mínimos sugeridos

Seleccione únicamente el repositorio de prueba y habilite según la demostración:

| Operación | Permiso fino sugerido |
|---|---|
| Consultar repositorios/metadatos | Metadata: read (incluido) |
| Leer/actualizar README y `.gitignore` | Contents: read and write |
| Consultar/crear issues | Issues: read and write |
| Actualizar descripción/administrar repositorio | Administration: read and write |

La creación de un repositorio para el usuario depende del tipo de token, propietario y políticas de la cuenta. Si esta operación no está disponible con el token fino, GitHub responderá `403` o `422`; no se deben ampliar permisos sin revisar primero la documentación del endpoint.

## 8. Instalación

Desde PowerShell, en la raíz:

```powershell
npm install
Copy-Item .env.example .env
```

Edite `.env` sin compartir su contenido:

```dotenv
GITHUB_TOKEN=github_pat_SU_TOKEN_REAL
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Nunca use `VITE_GITHUB_TOKEN`: cualquier variable `VITE_` queda disponible para el código del navegador.

## 9. Ejecución

### Frontend y backend juntos

```powershell
npm run dev
```

Abra `http://127.0.0.1:5173` o `http://localhost:5173`.

### Procesos separados

```powershell
npm run dev -w server
npm run dev -w client
```

### Producción del frontend

```powershell
npm run build
npm run preview -w client
```

El build estático no incluye el backend. Para una publicación real se necesita diseñar autenticación multiusuario, HTTPS, gestión de secretos y controles de autorización; este MVP no debe exponerse a Internet.

## 10. Funcionalidades

### Dashboard

- usuario y avatar autenticados;
- total de repositorios accesibles, públicos y privados;
- issues abiertos visibles para el usuario;
- conexión y Rate Limit real con fecha de reinicio.

### Repositorios

- paginación completa desde GitHub y paginación de interfaz;
- búsqueda por nombre/descripción;
- filtros público/privado y orden configurable;
- lenguaje, estrellas, forks, actualización y enlace oficial.

### Creación

- nombre, descripción, visibilidad, README y plantilla `.gitignore` opcional;
- validación previa y resumen de confirmación;
- ejecución real mediante `repos.createForAuthenticatedUser`;
- no hay reintento automático ni simulación si el nombre ya existe.

### Analizador determinista

Consulta repositorio, lenguajes, rama predeterminada, árbol Git recursivo, README, issues, ramas y commits. Detecta README, `.gitignore`, licencia, manifiestos de dependencias, documentación y workflows. También admite repositorios vacíos sin inventar archivos.

Las reglas actuales recomiendan:

- descripción cuando falta;
- README cuando falta o carece de encabezados habituales;
- `.gitignore` cuando no se detecta;
- evaluar una licencia, sin crearla automáticamente;
- considerar una tarea inicial cuando no hay issues abiertos.

No se realizan análisis de vulnerabilidades ni afirmaciones sobre calidad de código.

### Escrituras seguras

1. El servidor verifica acceso de escritura.
2. Obtiene contenido, rama y SHA vigentes.
3. Guarda una propuesta temporal durante diez minutos.
4. La interfaz muestra archivo, permisos, commit y diferencia.
5. El usuario puede cancelar.
6. Al confirmar, el servidor vuelve a consultar el estado.
7. Si el SHA o la descripción cambió, responde `409` y no sobrescribe.
8. Si coincide, Octokit realiza la operación y se muestra el commit real.

Los mensajes siguen Conventional Commits, por ejemplo `docs: agregar documentación inicial del repositorio`.

### Issues

Lista abiertos, cerrados o todos; muestra autor, fecha y etiquetas; excluye pull requests y abre el issue en GitHub. La creación usa etiquetas consultadas y un segundo paso de confirmación. No se cierran ni eliminan issues.

## 11. Ejemplos de consumo de API

Autenticación y Rate Limit en paralelo:

```js
const [userResponse, rateResponse] = await Promise.all([
  octokit.rest.users.getAuthenticated(),
  octokit.rest.rateLimit.get(),
]);
```

Paginación real de repositorios:

```js
const repositories = await octokit.paginate(
  octokit.rest.repos.listForAuthenticatedUser,
  { affiliation: 'owner,collaborator,organization_member', per_page: 100 },
);
```

Actualización de un archivo con control optimista:

```js
await octokit.rest.repos.createOrUpdateFileContents({
  owner,
  repo,
  path: 'README.md',
  message: 'docs: actualizar README del repositorio',
  content: Buffer.from(newContent, 'utf8').toString('base64'),
  sha: currentSha,
  branch: defaultBranch,
});
```

## 12. Métodos HTTP

| Método | Ruta local | Uso | Escritura |
|---|---|---|---|
| GET | `/api/health` | Salud y presencia de configuración | No |
| GET | `/api/auth/status` | Usuario, scopes informados y límite | No |
| GET | `/api/dashboard` | Métricas reales | No |
| GET | `/api/repositories` | Lista filtrada/paginada | No |
| POST | `/api/repositories` | Crear repositorio confirmado | Sí |
| GET | `/api/repositories/:owner/:repo/issues` | Listar issues | No |
| POST | `/api/repositories/:owner/:repo/issues` | Crear issue confirmado | Sí |
| GET | `/api/repositories/:owner/:repo/analysis` | Analizar | No |
| GET | `/api/repositories/:owner/:repo/templates` | Plantillas deterministas | No |
| POST | `/api/actions/preview` | Preparar cambio temporal | No |
| POST | `/api/actions/execute` | Ejecutar vista previa confirmada | Sí |

## 13. Seguridad

- `.env` y variantes están en `.gitignore`.
- Octokit se instancia solamente en el backend.
- El token no se registra, serializa ni retorna al frontend.
- El backend registra únicamente si existe configuración (`sí/no`).
- Validación Zod restringe nombres, tamaños, estados y tipos.
- Respuestas de error se normalizan y nunca incluyen el objeto original de Octokit.
- CORS acepta solo orígenes locales conocidos.
- Express escucha en loopback, no en todas las interfaces.
- Helmet añade cabeceras defensivas y el API local limita solicitudes.
- Operaciones de archivo comparan SHA y no realizan sobrescrituras ciegas.
- Las vistas previas expiran y son de un solo uso.
- Las escrituras exigen `confirmed: true`.

Para un despliegue público se requiere OAuth o GitHub App, sesiones seguras, autorización por usuario, CSRF, HTTPS, almacenamiento seguro de secretos, auditoría y límites distribuidos.

## 14. Rate Limiting y errores

Se muestran `limit`, `remaining`, `used` y `reset` devueltos por GitHub. No se presupone un límite de 5.000. GitHub también aplica límites secundarios que no pueden consultarse por anticipado.

| Estado | Mensaje tratado |
|---|---|
| 401 | Token inválido o revocado |
| 403 | Permisos insuficientes; si `remaining=0`, se presenta como límite |
| 404 | Recurso inexistente o no visible para el token |
| 409 | Conflicto, repositorio vacío o vista previa desactualizada |
| 422 | Datos rechazados/validación de GitHub |
| 429 | Límite temporal y fecha de reinicio cuando está disponible |

## 15. Pruebas

```powershell
npm test
npm run build
```

Las pruebas unitarias usan datos controlados únicamente para validar las reglas y no se presentan como evidencia de integración real. Cubren recomendaciones, generación de `.gitignore`, salud del API, cabecera local y validación previa.

### Protocolo de integración real

1. Crear un repositorio de prueba vacío y limitar el PAT a ese repositorio.
2. Verificar `/api/auth/status` y el usuario en pantalla.
3. Comparar listado y metadatos con GitHub.
4. Analizar el repositorio y contrastar cada archivo detectado.
5. Crear un issue con confirmación y abrir su enlace.
6. Previsualizar README, confirmar y verificar commit/contenido en GitHub.
7. Cambiar un archivo externamente entre vista previa y confirmación para comprobar el `409`.
8. Revocar el token al terminar la evidencia si fue creado solo para la actividad.

## 16. Resultados verificados en este entorno

| Comprobación | Resultado |
|---|---|
| Diagnóstico Node/npm/Git | Verificado; versiones documentadas arriba |
| Creación de estructura y archivos | Verificado en el workspace local |
| Protección `.env`/ausencia de token en frontend | Verificada por inspección local |
| Instalación de dependencias | No verificada: el entorno de ejecución no tuvo acceso utilizable al registro npm |
| Pruebas automatizadas | Pendientes de `npm install` por la limitación anterior |
| Build de Vite | Pendiente de `npm install` por la limitación anterior |
| Integración con GitHub | No ejecutada: no se proporcionó PAT autorizado |
| Escrituras reales | No ejecutadas: requieren repositorio de prueba autorizado |

No se declara como exitosa ninguna operación externa no observada.

## 17. Demostración para el instructor

La guía paso a paso está en [`docs/GUIA_DEMOSTRACION.md`](docs/GUIA_DEMOSTRACION.md). Incluye autenticación, consultas, creación del repositorio de prueba, análisis, recomendaciones, modificación confirmada y verificación directa en GitHub.

## 18. Conclusiones

El proyecto evidencia la separación entre interfaz, API local y proveedor externo; usa Octokit como fundamento; y convierte las operaciones peligrosas en flujos revisables. El analizador se limita a observaciones que puede demostrar con la API. La principal frontera del MVP es deliberada: un PAT único y local es adecuado para una práctica controlada, no para un producto multiusuario.

## 19. Referencias oficiales (APA 7)

GitHub, Inc. (2026). *Managing your personal access tokens*. GitHub Docs. https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

GitHub, Inc. (2026). *Rate limits for the REST API*. GitHub Docs. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

GitHub, Inc. (2026). *REST API endpoints for repositories*. GitHub Docs. https://docs.github.com/en/rest/repos/repos

GitHub, Inc. (2026). *REST API endpoints for repository contents*. GitHub Docs. https://docs.github.com/en/rest/repos/contents

GitHub, Inc. (2026). *REST API endpoints for issues*. GitHub Docs. https://docs.github.com/en/rest/issues/issues

GitHub. (2026). *Octokit.js: The all-batteries-included GitHub SDK*. GitHub. https://github.com/octokit/octokit.js

Node.js contributors. (2026). *Node.js documentation*. OpenJS Foundation. https://nodejs.org/docs/latest/api/

OpenJS Foundation. (2026). *Express 5.x API reference*. Express.js. https://expressjs.com/en/5x/api.html

Vite contributors. (2026). *Getting started*. Vite. https://vite.dev/guide/

Meta Platforms, Inc. (2026). *React documentation*. React. https://react.dev/
