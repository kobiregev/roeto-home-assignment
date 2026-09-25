import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/game/errors'
import { GameEvent, GameStatus, type DiceRoller } from '../src/game/types'
import { GameService } from '../src/services/gameService'
import { MemoryStore } from '../src/store/memoryStore'

let store: MemoryStore
let service: GameService
let dice: [number, number]
let alice: string
let bob: string
let carol: string

/** Awaits a promise that must reject with an AppError of the given status. */
const expectStatus = async (promise: Promise<unknown>, status: number) => {
   const error = await promise.then(
      () => undefined,
      (e) => e
   )
   expect(error).toBeInstanceOf(AppError)
   expect((error as AppError).status).toBe(status)
}

beforeEach(async () => {
   store = new MemoryStore()
   dice = [1, 2]
   const roller: DiceRoller = () => dice
   let n = 0
   service = new GameService(store, roller, () => `game-${++n}`)
   const create = async (username: string) => (await store.createUser({ username, passwordHash: 'x' })).id
   alice = await create('alice')
   bob = await create('bob')
   carol = await create('carol')
})

/** alice creates, bob joins. Returns the game id. */
const startGame = async (winningScore?: number) => {
   const game = await service.createGame(alice, winningScore)
   await service.joinGame(bob, game.id)
   return game.id
}

describe('createGame', () => {
   it('creates a waiting game with the creator and the default winning score', async () => {
      const game = await service.createGame(alice)
      expect(game.status).toBe(GameStatus.Waiting)
      expect(game.players.map((p) => p.username)).toEqual(['alice'])
      expect(game.winningScore).toBe(100)
      expect(await store.getGame(game.id)).toEqual(game)
   })

   it('uses a custom winning score', async () => {
      expect((await service.createGame(alice, 50)).winningScore).toBe(50)
   })

   it('abandons the creators unfinished games, waiting or active', async () => {
      const first = await service.createGame(alice)
      const second = await service.createGame(alice)
      expect((await service.getGame(alice, first.id)).status).toBe(GameStatus.Abandoned)
      expect((await service.getGame(alice, second.id)).status).toBe(GameStatus.Waiting)

      await service.joinGame(bob, second.id)
      await service.createGame(alice)
      // bob's window sees the game he was playing was abandoned
      expect((await service.getGame(bob, second.id)).status).toBe(GameStatus.Abandoned)
   })

   it('rejects an unknown user', async () => {
      await expectStatus(service.createGame('ghost'), 404)
   })
})

describe('joinGame', () => {
   it('starts the game when a different user joins', async () => {
      const created = await service.createGame(alice)
      const game = await service.joinGame(bob, created.id)
      expect(game.status).toBe(GameStatus.Active)
      expect(game.currentPlayerId).toBe(alice)
   })

   it('rejects the creator joining their own game, and keeps it waiting', async () => {
      const created = await service.createGame(alice)
      await expectStatus(service.joinGame(alice, created.id), 409)
      expect((await service.getGame(alice, created.id)).status).toBe(GameStatus.Waiting)
   })

   it('rejects a third user joining a full game', async () => {
      const id = await startGame()
      await expectStatus(service.joinGame(carol, id), 409)
   })

   it('rejects an unknown game', async () => {
      await expectStatus(service.joinGame(bob, 'nope'), 404)
   })

   it('abandons the joiners other unfinished game', async () => {
      const bobsOwn = await service.createGame(bob)
      const alices = await service.createGame(alice)
      await service.joinGame(bob, alices.id)
      expect((await service.getGame(bob, bobsOwn.id)).status).toBe(GameStatus.Abandoned)
      expect((await service.getGame(bob, alices.id)).status).toBe(GameStatus.Active)
   })

   it('a rejected join does not abandon the joiners current game', async () => {
      const id = await startGame() // alice vs bob
      const carols = await service.createGame(carol)
      await service.leaveGame(carol, carols.id) // no longer open
      await expectStatus(service.joinGame(alice, carols.id), 409)
      expect((await service.getGame(alice, id)).status).toBe(GameStatus.Active)
   })
})

describe('lobby and current game', () => {
   it('lists waiting games created by others only', async () => {
      const alices = await service.createGame(alice)
      await service.createGame(carol)
      const openForBob = await service.listOpenGames(bob)
      expect(openForBob.map((g) => g.players[0].username).sort()).toEqual(['alice', 'carol'])
      const openForAlice = await service.listOpenGames(alice)
      expect(openForAlice.map((g) => g.id)).not.toContain(alices.id)
      expect(openForAlice).toHaveLength(1)
   })

   it('a game leaves the lobby once it starts', async () => {
      await startGame()
      expect(await service.listOpenGames(carol)).toEqual([])
   })

   it('returns the current game, or null when the user never had one', async () => {
      expect(await service.getCurrentGame(alice)).toBeNull()
      const game = await service.createGame(alice)
      expect((await service.getCurrentGame(alice))!.id).toBe(game.id)
   })

   it('keeps returning a game that ended, so both players can see the result', async () => {
      const id = await startGame(10)
      dice = [5, 5]
      await service.roll(alice, id)
      await service.hold(alice, id)
      for (const user of [alice, bob]) {
         const current = await service.getCurrentGame(user)
         expect(current).toMatchObject({ id, status: GameStatus.Finished, winnerId: alice })
      }
   })

   it('shows the opponent that the game was abandoned', async () => {
      const id = await startGame()
      await service.leaveGame(alice, id)
      expect(await service.getCurrentGame(bob)).toMatchObject({ id, status: GameStatus.Abandoned })
   })

   it('prefers an unfinished game over an older finished one', async () => {
      const first = await startGame(10)
      dice = [5, 5]
      await service.roll(alice, first)
      await service.hold(alice, first)
      const next = await service.createGame(alice)
      expect((await service.getCurrentGame(alice))!.id).toBe(next.id)
      expect((await service.getCurrentGame(bob))!.id).toBe(first) // bob has not joined the new one yet
   })
})

describe('playing', () => {
   it('lets only the current player roll, and reports the event', async () => {
      const id = await startGame()
      dice = [3, 4]
      const { game, event } = await service.roll(alice, id)
      expect(event).toBe(GameEvent.Rolled)
      expect(game.roundScore).toBe(7)
      await expectStatus(service.roll(bob, id), 403)
   })

   it('persists every action', async () => {
      const id = await startGame()
      dice = [3, 4]
      await service.roll(alice, id)
      await service.hold(alice, id)
      const stored = await store.getGame(id)
      expect(stored!.players[0].score).toBe(7)
      expect(stored!.currentPlayerId).toBe(bob)
   })

   it('a double six reports a bust and passes the turn', async () => {
      const id = await startGame()
      dice = [6, 6]
      const { game, event } = await service.roll(alice, id)
      expect(event).toBe(GameEvent.Bust)
      expect(game.currentPlayerId).toBe(bob)
   })

   it('rejects roll and hold on a game that is waiting or unknown', async () => {
      const waiting = await service.createGame(alice)
      await expectStatus(service.roll(alice, waiting.id), 409)
      await expectStatus(service.hold(alice, waiting.id), 409)
      await expectStatus(service.roll(alice, 'nope'), 404)
   })

   it('does not persist a rejected action', async () => {
      const id = await startGame()
      const before = await store.getGame(id)
      await expectStatus(service.hold(alice, id), 409) // nothing to hold
      expect(await store.getGame(id)).toEqual(before)
   })
})

describe('winning', () => {
   const playToWin = async (id: string) => {
      dice = [5, 5]
      await service.roll(alice, id)
      return service.hold(alice, id)
   }

   it('finishes the game, names the winner and counts one win', async () => {
      const id = await startGame(10)
      const { game, event } = await playToWin(id)
      expect(event).toBe(GameEvent.Won)
      expect(game.status).toBe(GameStatus.Finished)
      expect(game.winnerId).toBe(alice)
      expect((await store.findUserById(alice))!.wins).toBe(1)
      expect((await store.findUserById(bob))!.wins).toBe(0)
   })

   it('rejects further actions on a finished game', async () => {
      const id = await startGame(10)
      await playToWin(id)
      await expectStatus(service.roll(alice, id), 409)
      await expectStatus(service.roll(bob, id), 409)
   })

   it('does not count a win for an abandoned game', async () => {
      const id = await startGame(10)
      await service.leaveGame(bob, id)
      expect((await store.findUserById(alice))!.wins).toBe(0)
   })

   it('counts a win once even if Hold is sent twice at the same time', async () => {
      const id = await startGame(10)
      dice = [5, 5]
      await service.roll(alice, id)
      const results = await Promise.allSettled([service.hold(alice, id), service.hold(alice, id)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect((await store.findUserById(alice))!.wins).toBe(1)
   })
})

describe('getGame and leaveGame', () => {
   it('shows a game to its participants only', async () => {
      const id = await startGame()
      expect((await service.getGame(bob, id)).id).toBe(id)
      await expectStatus(service.getGame(carol, id), 403)
      await expectStatus(service.getGame(alice, 'nope'), 404)
   })

   it('lets a participant leave, and rejects outsiders', async () => {
      const id = await startGame()
      await expectStatus(service.leaveGame(carol, id), 403)
      const game = await service.leaveGame(bob, id)
      expect(game.status).toBe(GameStatus.Abandoned)
   })
})
