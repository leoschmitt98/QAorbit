interface ProgressBarProps {
  value: number
}

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="h-2 rounded-full bg-white/5">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-accent via-[#b8ff3c] to-accent-soft"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
