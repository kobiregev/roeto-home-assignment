import type { Game } from '../api/types'

export const ALICE_ID = 'a'
export const BOB_ID = 'b'

/** A two-player active game where it is alice's turn. Override any field per test. */
export const makeGame = (overrides: Partial<Game> = {}): Game => ({
   id: 'g1',
   players: [
      { userId: ALICE_ID, username: 'alice', score: 40 },
      { userId: BOB_ID, username: 'bob', score: 25 },
   ],
   currentPlayerId: ALICE_ID,
   roundScore: 7,
   lastRoll: [3, 4],
   winningScore: 100,
   status: 'active',
   winnerId: null,
   acknowledgedBy: [],
   ...overrides,
})
