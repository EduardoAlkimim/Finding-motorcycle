const router = require('express').Router()
const c = require('../controllers/usuario.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar)
router.get('/',     autorizar('ADMIN', 'DESPACHANTE'), c.listar)
router.post('/',    autorizar('ADMIN'),                c.criar)
router.put('/:id',  autorizar('ADMIN'),                c.atualizar)
router.delete('/:id', autorizar('ADMIN'),              c.desativar)

module.exports = router
