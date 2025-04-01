// backend/middleware/validationMiddleware.js
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // İlk hatayı veya tüm hataları döndürmek isteyip istemediğinize karar verin
    // Şimdilik tüm hataları döndürelim
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { handleValidationErrors };