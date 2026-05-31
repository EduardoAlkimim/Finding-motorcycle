const router = require('express').Router()
const c = require('../controllers/entrega.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar)

router.get('/',    c.listar)
router.get('/:id', c.buscarUm)

router.post('/', autorizar('ADMIN', 'DESPACHANTE'), c.criar)

router.patch('/:id/iniciar',  autorizar('ADMIN', 'DESPACHANTE'), c.iniciar)
router.patch('/:id/concluir', autorizar('ADMIN', 'DESPACHANTE'), c.concluir)
router.patch('/:id/retorno',  autorizar('ADMIN', 'DESPACHANTE'), c.iniciarRetorno)
router.patch('/:id/finalizar',autorizar('ADMIN', 'DESPACHANTE'), c.finalizar)

router.patch('/parada/:entregaLocalId/confirmar', c.confirmarParada)
router.patch('/:id/locais/:localEntregaId/confirmar', c.confirmarParada)

router.patch('/:id/editar',   autorizar('ADMIN', 'DESPACHANTE'), c.editar)
router.delete('/:id', autorizar('ADMIN', 'DESPACHANTE'), c.deletar)

module.exports = router
