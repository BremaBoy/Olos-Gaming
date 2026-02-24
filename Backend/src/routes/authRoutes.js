const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, signupSchema, loginSchema } = require('../middleware/validate');

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/login', validate(loginSchema), authController.login);

module.exports = router;
