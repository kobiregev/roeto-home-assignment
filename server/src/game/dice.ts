import type { DiceRoller } from './types'

const d6 = () => 1 + Math.floor(Math.random() * 6)

export const randomDice: DiceRoller = () => [d6(), d6()]
