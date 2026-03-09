import { cn } from "@/lib/utils"

interface ShimmerProps {
  children: React.ReactNode
  className?: string
  duration?: number
}

export function Shimmer({ 
  children, 
  className,
  duration = 2 
}: ShimmerProps) {
  return (
    <span 
      className={cn(
        "inline-flex animate-text-shimmer bg-[linear-gradient(110deg,#939393,45%,#1e293b,55%,#939393)] bg-[length:250%_100%] bg-clip-text text-transparent",
        className
      )}
      style={{
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </span>
  )
}
