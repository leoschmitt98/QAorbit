import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  value: string
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value.toLowerCase()

  const tone =
    normalized.includes('aprov') ||
    normalized.includes('ativo') ||
    normalized.includes('conclu') ||
    normalized.includes('finaliz') ||
    normalized.includes('passou')
      ? 'success'
      : normalized.includes('crit') ||
          normalized.includes('bloq') ||
          normalized.includes('novo') ||
          normalized.includes('falhou')
        ? 'danger'
        : normalized.includes('parcial') || normalized.includes('analise') || normalized.includes('alta') || normalized.includes('andamento')
          ? 'warning'
          : 'info'

  return <Badge tone={tone}>{value}</Badge>
}
