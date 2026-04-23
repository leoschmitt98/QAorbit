import {
  Bot,
  Bug,
  ClipboardList,
  FileStack,
  FolderKanban,
  History,
  LayoutDashboard,
  Settings,
  ListChecks,
  Workflow,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agents', label: 'Central de Agentes', icon: Bot },
  { to: '/analysis/new', label: 'Nova Analise', icon: Workflow },
  { to: '/automation/blueprint', label: 'Blueprint de Automacao', icon: Bot },
  { to: '/flows/history', label: 'Historico de Fluxos', icon: History },
  { to: '/historical-tests', label: 'Historico de Testes', icon: History },
  { to: '/projects', label: 'Projetos', icon: FolderKanban },
  { to: '/demandas', label: 'Demandas', icon: ClipboardList },
  { to: '/functional-base', label: 'Base Funcional', icon: FileStack },
  { to: '/test-plans', label: 'Test Plans', icon: ListChecks },
  { to: '/bugs', label: 'Bugs / Chamados', icon: Bug },
  { to: '/settings', label: 'Configuracoes', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  return (
    <aside
      translate="no"
      className={cn(
        'notranslate w-full border-b border-border bg-black/35 px-4 py-4 backdrop-blur-xl lg:min-h-screen lg:border-b-0 lg:border-r',
        collapsed ? 'lg:w-24' : 'lg:w-72',
      )}
    >
      <div className={cn('flex items-center px-2 pb-6', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-soft font-display text-lg font-bold text-background shadow-glow">
          Q
        </div>
        {!collapsed ? (
          <div>
            <p className="font-display text-lg font-bold text-foreground">QA Orbit</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">QA Operational Workspace</p>
          </div>
        ) : null}
      </div>
      {onToggle ? (
        <div className={cn('pb-4', collapsed ? 'flex justify-center' : 'px-2')}>
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'rounded-2xl border border-border bg-white/[0.03] text-sm font-semibold text-muted transition hover:border-accent/30 hover:text-foreground',
              collapsed ? 'h-11 w-11' : 'px-4 py-3',
            )}
          >
            {collapsed ? '>' : 'Recolher menu'}
          </button>
        </div>
      ) : null}
      <nav className="grid gap-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-2xl px-4 py-3 text-sm font-medium text-muted transition hover:bg-white/[0.04] hover:text-foreground',
                collapsed ? 'justify-center' : 'gap-3',
                isActive && 'border border-accent/30 bg-accent/12 text-foreground shadow-glow',
              )
            }
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
            <span className={cn(collapsed ? 'sr-only' : 'inline')}>{label}</span>
          </NavLink>
        ))}
      </nav>
      {!collapsed ? (
        <div className="mt-8 rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 to-accent-soft/8 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Health Check</p>
          <p className="mt-3 text-sm font-semibold text-foreground">Workspace operacional ativo</p>
          <p className="mt-2 text-sm text-muted">
            Ultimo sync funcional executado hoje, 09:10, com 98.2% de consistencia entre bug, regra e prompt.
          </p>
        </div>
      ) : null}
    </aside>
  )
}
