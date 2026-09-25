import { useCallback, useState } from 'react'
import { PlayerWindow } from './components/PlayerWindow'

export default function App() {
   // Both windows live on this one page. Any action in either window bumps this counter, and every
   // window reloads its state when it changes. That is the whole "live update" mechanism: no polling.
   const [refreshTick, setRefreshTick] = useState(0)
   const refreshAll = useCallback(() => setRefreshTick((tick) => tick + 1), [])

   return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
         <div className="mx-auto max-w-5xl">
            <h1 className="text-3xl font-bold">Dice Game</h1>
            <p className="mb-6 text-slate-600">
               Two players, one page. Log each window in as a different user to play against each other.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
               <PlayerWindow
                  title="Window 1"
                  storageKey="dice.window.1"
                  refreshTick={refreshTick}
                  onChanged={refreshAll}
               />
               <PlayerWindow
                  title="Window 2"
                  storageKey="dice.window.2"
                  refreshTick={refreshTick}
                  onChanged={refreshAll}
               />
            </div>
         </div>
      </main>
   )
}
