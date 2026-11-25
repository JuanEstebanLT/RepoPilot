# Guía de demostración para el instructor

Esta guía separa consultas de escrituras. Use exclusivamente una cuenta propia y un repositorio creado para la evidencia.

## Preparación segura

1. Cree un PAT de acceso específico con vencimiento corto.
2. Limítelo al repositorio de prueba cuando GitHub lo permita.
3. Conceda `Metadata: read`, `Contents: read and write`, `Issues: read and write` y, solo si demostrará administración/creación, `Administration: read and write`.
4. Copie `.env.example` como `.env` y escriba allí el token.
5. Compruebe que `git status` nunca muestre `.env`.
6. Ejecute `npm install`, `npm test`, `npm run build` y finalmente `npm run dev`.

## Prueba 1: autenticación

1. Abra `http://localhost:5173`.
2. Observe “GitHub conectado”, usuario y avatar.
3. Abra Configuración y compruebe que solo informa “token configurado”; nunca muestra el valor.
4. Como evidencia negativa opcional, detenga el servidor, retire temporalmente `GITHUB_TOKEN`, reinicie y capture el mensaje de configuración faltante. Restáurelo sin mostrarlo en pantalla.

## Prueba 2: consulta real de repositorios

1. Abra **Mis repositorios**.
2. Busque el repositorio de prueba.
3. Cambie filtros y orden.
4. Abra el enlace de GitHub y compare descripción, visibilidad, lenguaje, estrellas, forks y actualización.

## Prueba 3: metadatos y Rate Limit

1. Vuelva al Dashboard.
2. Muestre límite, solicitudes restantes, utilizadas y reinicio.
3. Actualice la página y explique que los valores proceden de GitHub y no de una constante local.

## Prueba 4: consulta de issues

1. Abra **Gestión de issues** y seleccione el repositorio.
2. Consulte abiertos, cerrados y todos.
3. Abra uno en GitHub y compare título, autor, fecha y etiquetas.
4. Señale que los pull requests se excluyen explícitamente.

## Prueba 5: creación de un repositorio de prueba

Realice esta prueba solo si el token y la política de la cuenta permiten crear repositorios.

1. Abra **Crear repositorio**.
2. Use un nombre único, visibilidad privada y README inicial.
3. Pulse **Revisar creación**; muestre el resumen.
4. Cancele una primera vez para evidenciar que revisar no escribe.
5. Repita, confirme y abra el enlace devuelto.
6. Si GitHub rechaza por permisos, conserve el error como evidencia del control real; no amplíe permisos durante una presentación sin planificarlo.

## Prueba 6: análisis

1. Abra **Analizador**, seleccione el repositorio y pulse **Analizar repositorio**.
2. Muestre rama, lenguajes, archivos, dependencias, documentación, workflows, ramas, commits e issues.
3. Abra GitHub y contraste README, `.gitignore`, LICENSE y `.github/workflows`.

## Prueba 7: recomendaciones

1. Use un repositorio que omita deliberadamente uno de los elementos.
2. Explique la razón mostrada por la tarjeta.
3. Aclare que son reglas deterministas, no IA.
4. Pulse **Preparar acción**, edite la propuesta y genere la vista previa.
5. Muestre archivo afectado, permiso, commit y diff; pulse **Cancelar** para probar que no se escribió nada.

## Prueba 8: modificación autorizada

1. Prepare de nuevo un README o `.gitignore`.
2. Revise cuidadosamente el diff.
3. Confirme y anote el SHA de commit devuelto.
4. Abra GitHub, busque el commit y compare contenido/mensaje.
5. Vuelva a analizar para comprobar que la interfaz actualizó el estado.

## Evidencias recomendadas

- terminal sin token visible con backend y frontend activos;
- Dashboard autenticado y Rate Limit;
- lista real y comparación con github.com;
- resumen previo a un POST;
- análisis y archivos correspondientes;
- diff antes de escribir;
- respuesta con SHA y el mismo commit abierto en GitHub;
- salida de `npm test` y `npm run build`.

## Cierre

Detenga los procesos con `Ctrl+C`. Si el PAT se creó únicamente para la actividad, revoque el token en GitHub. No incluya `.env`, capturas del token ni cabeceras `Authorization` en la entrega.
