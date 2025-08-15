const { body, validationResult } = require('express-validator');

// Middleware to handle the result of the validation chains
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidation = [
  body('name').notEmpty().withMessage('Nama tidak boleh kosong.'),
  body('email').isEmail().withMessage('Format email tidak valid.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal harus 6 karakter.'),
  handleValidationErrors,
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Token tidak boleh kosong.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal harus 6 karakter.'),
  handleValidationErrors,
];

const loginValidation = [
  body('email').isEmail().withMessage('Format email tidak valid.'),
  body('password').notEmpty().withMessage('Password tidak boleh kosong.'),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  resetPasswordValidation,
  loginValidation,
};