'use strict';

const { AppError } = require('../errors');

function notFound(req, res, next) {
  next(new AppError(404, 'Ruta no encontrada'));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode;
  let message = err.message;

  if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño permitido' : 'Archivo inválido';
  } else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    status = 400;
    message = 'JSON inválido';
  }

  if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;

  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl}`, err);
    if (!(err instanceof AppError)) message = 'Error interno del servidor';
  }

  const body = { error: message };
  if (err instanceof AppError && err.details !== undefined) body.details = err.details;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
