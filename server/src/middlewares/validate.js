export function validate(schema, location = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[location]);

    if (!parsed.success) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los datos enviados no son válidos.',
          details: parsed.error.issues.map(({ path, message }) => ({
            field: path.join('.'),
            message,
          })),
        },
      });
    }

    // Express 5 expone req.query mediante un getter.
    // No debe reasignarse directamente.
    if (location === 'query') {
      req.validatedQuery = parsed.data;
    } else {
      req[location] = parsed.data;
    }

    return next();
  };
}