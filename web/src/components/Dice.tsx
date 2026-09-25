// Unicode die faces U+2680 to U+2685 for values 1 to 6.
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

/** Shows the two dice the server rolled last. Nothing is rolled or computed here. */
export function Dice({ roll }: { roll: [number, number] | null }) {
   if (!roll) {
      return <p className="h-20 text-center text-sm leading-[5rem] text-slate-400">No roll yet</p>
   }
   return (
      <p aria-label={`Dice: ${roll[0]} and ${roll[1]}`} className="flex justify-center gap-3 text-7xl leading-none">
         <span aria-hidden>{FACES[roll[0] - 1]}</span>
         <span aria-hidden>{FACES[roll[1] - 1]}</span>
      </p>
   )
}
