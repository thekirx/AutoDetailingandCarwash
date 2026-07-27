/**
 * Native select that always shows human labels (avoids Base UI Select UUID display bug).
 */
export function NamedSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className = '',
  required = false,
  disabled = false,
  emptyLabel = null,
}) {
  return (
    <select
      id={id}
      required={required}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={`flex h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {emptyLabel != null && <option value="">{emptyLabel}</option>}
      {placeholder && value === '' && emptyLabel == null ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
