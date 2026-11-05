export type BadgeTone = 'neutral' | 'primary' | 'positive' | 'warning' | 'negative'

interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
}

export const Badge = ({ tone = 'neutral', children }: BadgeProps) => {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  )
}
