import { FileImage, FileText, Film } from 'lucide-react'
import { Card } from '@/components/ui/card'

const uploaderItems = [
  { label: 'Print', icon: FileImage },
  { label: 'GIF', icon: Film },
  { label: 'Log', icon: FileText },
]

export function EvidenceUploader() {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm text-muted">Upload mockado</p>
        <h3 className="font-display text-xl font-bold text-foreground">Pacote de evidencias</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {uploaderItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="rounded-2xl border border-dashed border-accent/25 bg-accent/6 p-4 text-left transition hover:border-accent/40 hover:shadow-glow"
          >
            <Icon className="h-5 w-5 text-accent" />
            <p className="mt-4 font-semibold text-foreground">Anexar {label}</p>
            <p className="mt-1 text-sm text-muted">Fluxo visual pronto para storage real.</p>
          </button>
        ))}
      </div>
    </Card>
  )
}
