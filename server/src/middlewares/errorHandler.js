const STATUS_MESSAGES = {
  400: 'La solicitud no tiene el formato esperado.',
  401: 'El token de GitHub no es válido o fue revocado.',
  403: 'GitHub rechazó la operación por permisos insuficientes o límite de solicitudes.',
  404: 'El recurso no existe o el token no tiene acceso.',
  409: 'La operación produjo un conflicto con el estado actual del repositorio.',
  422: 'GitHub rechazó los datos enviados. Revise los campos y vuelva a intentarlo.',
  429: 'Se alcanzó un límite temporal de solicitudes. Espere antes de reintentar.',
  503: 'El servidor local no está configurado para conectarse con GitHub. Revise GITHUB_TOKEN.',
};

const CODE_MESSAGES = {
  REPOSITORY_NAME_TAKEN: 'Ya existe un repositorio con ese nombre para el owner seleccionado.',
  REPOSITORY_NOT_FOUND_OR_PRIVATE: 'El repositorio no existe, es privado o el token no puede consultarlo.',
  WRITE_PERMISSION_REQUIRED: 'GitHub no concedió permisos de escritura para este repositorio.',
  INVALID_GITHUB_TEMPLATE: 'El repositorio indicado no es una GitHub Template válida.',
  PREVIEW_EXPIRED: 'La vista previa expiró. Genere una nueva antes de confirmar.',
  PREVIEW_OWNER_CHANGED: 'La cuenta autenticada cambió después de generar la vista previa. Genere una nueva.',
};

function githubStatus(error) {
  const status = Number(error.status) || 500;
  if (status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') return 429;
  return status;
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada.' } });
}

export function errorHandler(error, req, res, _next) {
  const status = githubStatus(error);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const knownCodes = new Set([
    'REPOSITORY_NOT_FOUND_OR_PRIVATE', 'WRITE_PERMISSION_REQUIRED', 'TOKEN_NOT_CONFIGURED',
    'INVALID_GITHUB_TEMPLATE', 'INVALID_REPOPILOT_TEMPLATE', 'PREVIEW_EXPIRED',
    'NO_CHANGES', 'STALE_PREVIEW', 'PREVIEW_OWNER_CHANGED', 'VALIDATION_ERROR',
  ]);
  let code = error.code || `HTTP_${safeStatus}`;
  if (!error.code && safeStatus === 422 && /already exists|name already exists/i.test(error.response?.data?.message || '')) code = 'REPOSITORY_NAME_TAKEN';
  if (!error.code && safeStatus === 404 && req.path.startsWith('/explore/')) code = 'REPOSITORY_NOT_FOUND_OR_PRIVATE';
  const message = CODE_MESSAGES[code] || (knownCodes.has(code)
    ? error.message
    : STATUS_MESSAGES[safeStatus] || (safeStatus < 500 ? error.message : 'Ocurrió un error inesperado en el servidor.'));

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${new Date().toISOString()}] ${error.name || 'Error'}: ${message}`);
  }

  res.status(safeStatus).json({
    error: {
      code,
      message,
      requestId: error.response?.headers?.['x-github-request-id'],
      resetAt: error.response?.headers?.['x-ratelimit-reset']
        ? new Date(Number(error.response.headers['x-ratelimit-reset']) * 1000).toISOString()
        : undefined,
    },
  });
}
