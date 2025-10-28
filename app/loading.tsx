import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-6">
        <Spinner size="lg" />
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground">Loading Doable</h2>
          <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
        </div>
      </div>
    </div>
  )
}
