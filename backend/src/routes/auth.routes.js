// auth.routes.js
const router = require('express').Router()
const { login, me } = require('../controllers/auth.controller')
const { autenticar } = require('../middlewares/auth.middleware')

router.post('/login', login)
router.get('/me', autenticar, me)

module.exports = router
