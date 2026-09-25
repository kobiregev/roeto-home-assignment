export function ErrorBanner({ message }: { message: string | null }) {
   if (!message) return null
   return (
      <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
         {message}
      </p>
   )
}
