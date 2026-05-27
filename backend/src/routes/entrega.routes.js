const router = require('express').Router()
const c = require('../controllers/entrega.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar)
router.get('/',                                   c.listar)
router.get('/:id',                                c.buscarUm)
router.post('/',   autorizar('ADMIN','DESPACHANTE'), c.criar)
router.patch('/:id/iniciar',   autorizar('ADMIN','DESPACHANTE'), c.iniciar)
router.patch('/:id/finalizar', autorizar('ADMIN','DESPACHANTE'), c.finalizar)
router.patch('/parada/:entregaLocalId/confirmar', autorizar('MOTOQUEIRO'), c.confirmarParada)

module.exports = router
