import { describe, expect, it } from 'vitest'
import { acknowledge, createGame, hold, joinGame, leaveGame, roll } from '../src/game/engine'
import { AppError } from '../src/game/errors'
import { GameEvent, GameStatus, type DiceRoller, type Game } from '../src/game/types'

const alice = { userId: 'a', username: 'alice' }
const bob = { userId: 'b', username: 'bob' }
const carol = { userId: 'c', username: 'carol' }

/** A roller that always returns the same dice. */
const fixed =
   (d1: number, d2: number): DiceRoller =>
   () => [d1, d2]

const waitingGame = (winningScore = 100): Game => createGame('g1', alice, winningScore)
const activeGame = (winningScore = 100): Game => joinGame(waitingGame(winningScore), bob)

/** Asserts that fn throws an AppError with the given HTTP status. */
const expectStatus = (fn: () => unknown, status: number) => {
   try {
      fn()
   } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).status).toBe(status)
      return
   }
   throw new Error(`expected AppError ${status}, but nothing was thrown`)
}

describe('lobby', () => {
   it('starts waiting with only the creator and nobody to act', () => {
      const g = waitingGame()
      expect(g.status).toBe(GameStatus.Waiting)
      expect(g.players).toEqual([{ userId: 'a', username: 'alice', score: 0 }])
      expect(g.currentPlayerId).toBeNull()
   })

   it('becomes active when a different user joins, and the creator goes first', () => {
      const g = activeGame()
      expect(g.status).toBe(GameStatus.Active)
      expect(g.players.map((p) => p.userId)).toEqual(['a', 'b'])
      expect(g.currentPlayerId).toBe('a')
   })

   it('rejects the creator joining their own game (no playing against yourself)', () => {
      expectStatus(() => joinGame(waitingGame(), alice), 409)
   })

   it('rejects a third user joining a full game', () => {
      expectStatus(() => joinGame(activeGame(), carol), 409)
   })

   it('rejects roll and hold while waiting', () => {
      expectStatus(() => roll(waitingGame(), 'a', fixed(1, 2)), 409)
      expectStatus(() => hold(waitingGame(), 'a'), 409)
   })

   it('does not mutate the previous state', () => {
      const before = waitingGame()
      joinGame(before, bob)
      expect(before.status).toBe(GameStatus.Waiting)
      expect(before.players).toHaveLength(1)
   })
})

describe('roll', () => {
   it('adds the sum of both dice to the round score', () => {
      const { game, event } = roll(activeGame(), 'a', fixed(3, 4))
      expect(event).toBe(GameEvent.Rolled)
      expect(game.roundScore).toBe(7)
      expect(game.lastRoll).toEqual([3, 4])
      expect(game.currentPlayerId).toBe('a')
   })

   it('accumulates over several rolls', () => {
      let g = activeGame()
      g = roll(g, 'a', fixed(1, 2)).game
      g = roll(g, 'a', fixed(5, 5)).game
      expect(g.roundScore).toBe(13)
   })

   it('6 & 6 loses the round score and passes the turn', () => {
      const g = roll(activeGame(), 'a', fixed(3, 4)).game
      const res = roll(g, 'a', fixed(6, 6))
      expect(res.event).toBe(GameEvent.Bust)
      expect(res.game.roundScore).toBe(0)
      expect(res.game.players[0].score).toBe(0)
      expect(res.game.currentPlayerId).toBe('b')
      expect(res.game.lastRoll).toEqual([6, 6])
   })

   it('6 & 6 does not touch points that were already banked', () => {
      let g = roll(activeGame(), 'a', fixed(3, 4)).game
      g = hold(g, 'a').game // a: 7
      g = roll(g, 'b', fixed(1, 1)).game
      g = hold(g, 'b').game // b: 2, back to a
      g = roll(g, 'a', fixed(6, 6)).game
      expect(g.players.map((p) => p.score)).toEqual([7, 2])
   })

   it('a single 6 is not a bust', () => {
      const { game, event } = roll(activeGame(), 'a', fixed(6, 5))
      expect(event).toBe(GameEvent.Rolled)
      expect(game.roundScore).toBe(11)
      expect(game.currentPlayerId).toBe('a')
   })

   it('rejects the player whose turn it is not', () => {
      expectStatus(() => roll(activeGame(), 'b', fixed(1, 1)), 403)
   })

   it('rejects users who are not in the game', () => {
      expectStatus(() => roll(activeGame(), 'c', fixed(1, 1)), 403)
   })

   it('does not mutate the previous state', () => {
      const before = activeGame()
      roll(before, 'a', fixed(3, 4))
      expect(before.roundScore).toBe(0)
      expect(before.lastRoll).toBeNull()
   })
})

describe('hold', () => {
   it('banks the round score and passes the turn', () => {
      const g = roll(activeGame(), 'a', fixed(3, 4)).game
      const { game, event } = hold(g, 'a')
      expect(event).toBe(GameEvent.Held)
      expect(game.players[0].score).toBe(7)
      expect(game.roundScore).toBe(0)
      expect(game.currentPlayerId).toBe('b')
      expect(game.lastRoll).toBeNull()
   })

   it('rejects holding with nothing to bank', () => {
      expectStatus(() => hold(activeGame(), 'a'), 409)
   })

   it('rejects the player whose turn it is not', () => {
      const g = roll(activeGame(), 'a', fixed(3, 4)).game
      expectStatus(() => hold(g, 'b'), 403)
   })

   it('wins when the banked total reaches the winning score', () => {
      const g = roll(activeGame(10), 'a', fixed(5, 5)).game
      const { game, event } = hold(g, 'a')
      expect(event).toBe(GameEvent.Won)
      expect(game.status).toBe(GameStatus.Finished)
      expect(game.winnerId).toBe('a')
      expect(game.players[0].score).toBe(10)
      expect(game.currentPlayerId).toBeNull()
   })

   it('wins when the total goes over the winning score', () => {
      const g = roll(activeGame(10), 'a', fixed(6, 5)).game
      expect(hold(g, 'a').game.winnerId).toBe('a')
   })

   it('does not win below the target', () => {
      const g = roll(activeGame(11), 'a', fixed(5, 5)).game
      const { game, event } = hold(g, 'a')
      expect(event).toBe(GameEvent.Held)
      expect(game.status).toBe(GameStatus.Active)
      expect(game.winnerId).toBeNull()
   })

   it('does not win just by rolling past the target; only a hold wins', () => {
      const { game } = roll(activeGame(10), 'a', fixed(6, 5))
      expect(game.status).toBe(GameStatus.Active)
   })

   it('rejects roll and hold once the game is finished', () => {
      const won = hold(roll(activeGame(10), 'a', fixed(5, 5)).game, 'a').game
      expectStatus(() => roll(won, 'a', fixed(1, 1)), 409)
      expectStatus(() => hold(won, 'a'), 409)
   })

   it('plays a sequence between two players', () => {
      let g = activeGame(100)
      g = roll(g, 'a', fixed(2, 3)).game
      g = hold(g, 'a').game // a: 5
      g = roll(g, 'b', fixed(6, 6)).game // b busts, back to a
      expect(g.currentPlayerId).toBe('a')
      g = roll(g, 'a', fixed(1, 1)).game
      g = hold(g, 'a').game // a: 7
      expect(g.players.map((p) => p.score)).toEqual([7, 0])
      expect(g.currentPlayerId).toBe('b')
   })
})

describe('leave', () => {
   it('lets the creator cancel a waiting game', () => {
      const g = leaveGame(waitingGame(), 'a')
      expect(g.status).toBe(GameStatus.Abandoned)
      expect(g.currentPlayerId).toBeNull()
   })

   it('lets either player quit an active game, with no winner', () => {
      const g = leaveGame(activeGame(), 'b')
      expect(g.status).toBe(GameStatus.Abandoned)
      expect(g.winnerId).toBeNull()
      expect(g.currentPlayerId).toBeNull()
   })

   it('rejects non-participants', () => {
      expectStatus(() => leaveGame(activeGame(), 'c'), 403)
   })

   it('rejects leaving a game that is already over', () => {
      const won = hold(roll(activeGame(10), 'a', fixed(5, 5)).game, 'a').game
      expectStatus(() => leaveGame(won, 'a'), 409)
      expectStatus(() => leaveGame(leaveGame(waitingGame(), 'a'), 'a'), 409)
   })
})

describe('acknowledge', () => {
   const abandoned = (): Game => leaveGame(activeGame(), 'b')
   const finished = (): Game => {
      const rolled = roll(activeGame(10), 'a', fixed(5, 5)).game
      return hold(rolled, 'a').game
   }

   it('starts with nobody having acknowledged', () => {
      expect(waitingGame().acknowledgedBy).toEqual([])
   })

   it('records the player on an abandoned game and on a finished game', () => {
      expect(acknowledge(abandoned(), 'a').acknowledgedBy).toEqual(['a'])
      expect(acknowledge(finished(), 'b').acknowledgedBy).toEqual(['b'])
   })

   it('tracks each player separately', () => {
      const both = acknowledge(acknowledge(abandoned(), 'a'), 'b')
      expect(both.acknowledgedBy).toEqual(['a', 'b'])
   })

   it('is idempotent', () => {
      const once = acknowledge(abandoned(), 'a')
      expect(acknowledge(once, 'a')).toBe(once)
   })

   it('rejects a player who is not in the game', () => {
      expectStatus(() => acknowledge(abandoned(), 'c'), 403)
   })

   it('rejects a game that is not over yet', () => {
      expectStatus(() => acknowledge(waitingGame(), 'a'), 409)
      expectStatus(() => acknowledge(activeGame(), 'a'), 409)
   })

   it('does not mutate the previous state', () => {
      const before = abandoned()
      acknowledge(before, 'a')
      expect(before.acknowledgedBy).toEqual([])
   })
})
