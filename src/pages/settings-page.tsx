import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Configuracoes"
        title="Governanca da plataforma"
        description="Espaco reservado para perfis, integracoes, templates de bug, automacoes e padroes de nomenclatura."
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3">
          <p className="font-semibold text-white">Padrao de evidencias</p>
          <p className="text-sm text-slate-400">Naming convention, tipagem de anexos e politica de retencao ja mapeadas para futura configuracao.</p>
        </Card>
        <Card className="space-y-3">
          <p className="font-semibold text-white">Integracoes futuras</p>
          <p className="text-sm text-slate-400">Espaco preparado para API, storage, notificacoes, Jira, Azure DevOps e autenticacao corporativa.</p>
        </Card>
      </section>
    </div>
  )
}
