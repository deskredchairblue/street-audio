// src/middleware/error.js

/**
 * General error handling middleware.
 * @param {Object} err - Error object.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    res.status(400).json({ error: `Multer error: ${err.message}` });
  } else if (err.name === 'UnauthorizedError') {
    // JWT authentication errors
    res.status(401).json({ error: 'Invalid token' });
  } else {
    // General errors
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = errorHandler;