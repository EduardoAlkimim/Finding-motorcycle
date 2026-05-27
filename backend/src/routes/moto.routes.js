const router = require('express').Router()
const c = require('../controllers/moto.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar)
router.get('/posicoes-live',  c.posicoesLive)          // todas as motos ao vivo
router.get('/',               c.listar)
router.post('/',              autorizar('ADMIN'), c.criar)
router.put('/:id',            autorizar('ADMIN'), c.atualizar)
router.get('/:id/posicao',    c.ultimaPosicao)          // última posição
router.get('/:id/trajeto',    c.trajeto)                // trajeto do dia

module.exports = router
