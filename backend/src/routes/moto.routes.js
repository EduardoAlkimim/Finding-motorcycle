const router = require('express').Router()
const c = require('../controllers/moto.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar)
router.get('/posicoes-live',              c.posicoesLive)
router.get('/',                           c.listar)
router.post('/',                          autorizar('ADMIN'), c.criar)
router.put('/:id',                        autorizar('ADMIN'), c.atualizar)
router.get('/:id/posicao',                c.ultimaPosicao)
router.get('/:id/trajeto',                c.trajeto)
router.get('/:id/viagens',                c.viagens)
router.get('/:id/viagens-nao-autorizadas',c.viagensNaoAutorizadas)
router.get('/:id/km-nao-autorizado',      c.kmNaoAutorizado)

module.exports = router
