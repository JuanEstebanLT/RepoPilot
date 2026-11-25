export function requireLocalClient(req, res, next) {
  if (req.path === '/health') return next();
  if (req.get('X-Repo-Manager') !== 'local-client') {
    return res.status(403).json({
      error: { code: 'LOCAL_CLIENT_REQUIRED', message: 'Solicitud rechazada por la política de acceso local.' },
    });
  }
  return next();
}
