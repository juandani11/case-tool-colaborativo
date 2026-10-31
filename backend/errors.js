'use strict';

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

function httpError(status, message, details) {
  return new AppError(status, message, details);
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { AppError, httpError, asyncHandler };
