interface HangerIconProps {
  size?: number
  className?: string
}

/** Kloset's brush-drawn hanger mark, tinted by the surrounding text color. */
export function HangerIcon({ size = 24, className }: HangerIconProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flex: '0 0 auto',
        backgroundColor: 'currentColor',
        maskImage: "url('/images/kloset-hanger-mark.webp')",
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: "url('/images/kloset-hanger-mark.webp')",
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  )
}
