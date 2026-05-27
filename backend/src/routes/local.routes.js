const router = require('express').Router()
const c = require('../controllers/local.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar)
router.get('/',       c.listar)
router.post('/',      autorizar('ADMIN', 'DESPACHANTE'), c.criar)
router.put('/:id',    autorizar('ADMIN', 'DESPACHANTE'), c.atualizar)
router.delete('/:id', autorizar('ADMIN'),                c.remover)

module.exports = router
