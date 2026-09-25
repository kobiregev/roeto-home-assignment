import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeGame } from '../test/fixtures'
import { Lobby } from './Lobby'

const waiting = (id: string, username: string, winningScore = 100) =>
   makeGame({ id, status: 'waiting', winningScore, players: [{ userId: id, username, score: 0 }] })

const renderLobby = (openGames = [] as ReturnType<typeof waiting>[], busy = false) => {
   const onCreate = vi.fn()
   const onJoin = vi.fn()
   render(<Lobby openGames={openGames} busy={busy} onCreate={onCreate} onJoin={onJoin} />)
   return { onCreate, onJoin }
}

describe('Lobby', () => {
   it('creates a game with the default winning score', async () => {
      const user = userEvent.setup()
      const { onCreate } = renderLobby()

      await user.click(screen.getByRole('button', { name: 'Create game' }))

      expect(onCreate).toHaveBeenCalledWith(100)
   })

   it('creates a game with a custom winning score', async () => {
      const user = userEvent.setup()
      const { onCreate } = renderLobby()

      await user.clear(screen.getByLabelText('Winning score'))
      await user.type(screen.getByLabelText('Winning score'), '30')
      await user.click(screen.getByRole('button', { name: 'Create game' }))

      expect(onCreate).toHaveBeenCalledWith(30)
   })

   it('leaves the choice to the server when the field is empty', async () => {
      const user = userEvent.setup()
      const { onCreate } = renderLobby()

      await user.clear(screen.getByLabelText('Winning score'))
      await user.click(screen.getByRole('button', { name: 'Create game' }))

      expect(onCreate).toHaveBeenCalledWith(undefined)
   })

   it('lists open games from other players and joins the chosen one', async () => {
      const user = userEvent.setup()
      const { onJoin } = renderLobby([waiting('g1', 'alice', 50), waiting('g2', 'carol')])

      expect(screen.getByText(/alice/)).toBeInTheDocument()
      expect(screen.getByText(/first to 50/)).toBeInTheDocument()
      const joinButtons = screen.getAllByRole('button', { name: 'Join' })
      expect(joinButtons).toHaveLength(2)

      await user.click(joinButtons[1])

      expect(onJoin).toHaveBeenCalledWith('g2')
   })

   it('explains when there are no open games', () => {
      renderLobby()
      expect(screen.getByText(/no open games/i)).toBeInTheDocument()
   })

   it('disables the buttons while a request is in flight', () => {
      renderLobby([waiting('g1', 'alice')], true)
      expect(screen.getByRole('button', { name: 'Create game' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled()
   })
})
