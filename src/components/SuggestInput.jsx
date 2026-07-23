import { useId, useMemo, useRef, useState } from 'react'

/**
 * Compact autocomplete for tablet floor / booking forms.
 * Allows free text (unknown brands) while suggesting catalog matches.
 */
export default function SuggestInput({
  label,
  value,
  onChange,
  options = [],
  placeholder = '',
  required = false,
  disabled = false,
  id: idProp,
  className = '',
  inputClassName = '',
}) {
  const autoId = useId()
  const id = idProp || autoId
  const listId = `${id}-list`
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase()
    if (!q) return options.slice(0, 12)
    return options.filter((o) => String(o).toLowerCase().includes(q)).slice(0, 12)
  }, [options, value])

  const pick = (next) => {
    onChange(next)
    setOpen(false)
  }

  const onKeyDown = (event) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (!open || !filtered.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % filtered.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (event.key === 'Enter' && filtered[active]) {
      event.preventDefault()
      pick(filtered[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label className={`suggest-field ${className}`} ref={wrapRef}>
      {label ? <span className="suggest-label">{label}</span> : null}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        className={inputClassName}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so option click registers
          window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul id={listId} role="listbox" className="suggest-list">
          {filtered.map((opt, index) => (
            <li
              key={opt}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'suggest-option suggest-option-active' : 'suggest-option'}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(opt)
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}
