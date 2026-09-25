import { Router } from 'express'
import { currentUserId } from '../middleware/auth'
import { createGameSchema, parse } from '../schemas'
import type { GameService } from '../services/gameService'

/** Thin HTTP layer: validate input, call the service, shape the response. Mounted behind requireAuth. */
export function gameRoutes(games: GameService): Router {
   const router = Router()

   router.post('/', async (req, res) => {
      const { winningScore } = parse(createGameSchema, req.body)
      const game = await games.createGame(currentUserId(req), winningScore)
      res.status(201).json({ game })
   })

   // Declared before '/:id' so they are not mistaken for game ids.
   router.get('/open', async (req, res) => {
      const openGames = await games.listOpenGames(currentUserId(req))
      res.json({ games: openGames })
   })

   router.get('/current', async (req, res) => {
      const game = await games.getCurrentGame(currentUserId(req))
      res.json({ game })
   })

   router.get('/:id', async (req, res) => {
      const game = await games.getGame(currentUserId(req), req.params.id)
      res.json({ game })
   })

   router.post('/:id/join', async (req, res) => {
      const game = await games.joinGame(currentUserId(req), req.params.id)
      res.json({ game })
   })

   router.post('/:id/roll', async (req, res) => {
      const result = await games.roll(currentUserId(req), req.params.id)
      res.json(result)
   })

   router.post('/:id/hold', async (req, res) => {
      const result = await games.hold(currentUserId(req), req.params.id)
      res.json(result)
   })

   router.post('/:id/leave', async (req, res) => {
      const game = await games.leaveGame(currentUserId(req), req.params.id)
      res.json({ game })
   })

   return router
}
