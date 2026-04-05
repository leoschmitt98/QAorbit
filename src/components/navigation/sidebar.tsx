import {
  Bot,
  Bug,
  FileStack,
  FolderKanban,
  History,
  LayoutDashboard,
  Settings,
  Workflow,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agents', label: 'Central de Agentes', icon: Bot },
  { to: '/analysis/new', label: 'Nova Analise', icon: Workflow },
  { to: '/flows/history', label: 'Historico de Fluxos', icon: History },
  { to: '/historical-tests', label: 'Historico de Testes', icon: History },
  { to: '/projects', label: 'Projetos', icon: FolderKanban },
  { to: '/functional-base', label: 'Base Funcional', icon: FileStack },
  { to: '/bugs', label: 'Bugs / Chamados', icon: Bug },
  { to: '/settings', label: 'Configuracoes', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-full border-b border-border bg-black/35 px-4 py-4 backdrop-blur-xl lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 px-2 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-soft font-display text-lg font-bold text-background shadow-glow">
          Q
        </div>
        <div>
          <p className="font-display text-lg font-bold text-foreground">QA Orbit</p>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">QA Operational Workspace</p>
        </div>
      </div>
      <nav className="grid gap-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted transition hover:bg-white/[0.04] hover:text-foreground',
                isActive && 'border border-accent/30 bg-accent/12 text-foreground shadow-glow',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8 rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 to-accent-soft/8 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Health Check</p>
        <p className="mt-3 text-sm font-semibold text-foreground">Workspace operacional ativo</p>
        <p className="mt-2 text-sm text-muted">
          Ultimo sync funcional executado hoje, 09:10, com 98.2% de consistencia entre bug, regra e prompt.
        </p>
      </div>
    </aside>
  )
}
