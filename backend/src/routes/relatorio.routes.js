const router = require('express').Router()
const c = require('../controllers/relatorio.controller')
const { autenticar, autorizar } = require('../middlewares/auth.middleware')

router.use(autenticar, autorizar('ADMIN', 'DESPACHANTE'))
router.get('/dashboard',   c.dashboardDia)    // ?data=2024-01-15
router.get('/motoqueiro',  c.porMotoqueiro)   // ?motoqueiroId=X&dataInicio=Y&dataFim=Z
router.get('/km',          c.kmPorPeriodo)    // ?dataInicio=Y&dataFim=Z

module.exports = router
