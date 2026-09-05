export default function TikTokIcon({ size = 24, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 4v10.3a4.8 4.8 0 1 1-4-4.73" />
      <path d="M15 4c.55 2.58 2.3 4.17 5 4.5" />
    </svg>
  )
}
