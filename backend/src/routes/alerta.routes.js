const router = require('express').Router()
const c = require('../controllers/alerta.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar, autorizar('ADMIN', 'DESPACHANTE'))
router.get('/',              c.listar)
router.patch('/ler-todos',   c.marcarTodosLidos)
router.patch('/:id/ler',     c.marcarLido)

module.exports = router
