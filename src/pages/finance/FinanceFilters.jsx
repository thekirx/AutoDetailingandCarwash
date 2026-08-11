/** Shared Finance filter bar: branch + date preset + custom range.
 * Used by every Finance tab so the window is consistent. */
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { NamedSelect } from '@/components/ui/named-select'
import { DATE_PRESETS } from '@/lib/financeData'

export default function FinanceFilters({
  branchOptions,
  branchFilter,
  onBranchChange,
  datePreset,
  onDatePresetChange,
  customStart,
  customEnd,
  onCustomRangeChange,
  showBranch = true,
}) {
  return (
    <div className="finance-filters">
      {showBranch && branchOptions.length > 1 ? (
        <div className="finance-filter-group">
          <Label htmlFor="finance-branch-filter">Branch</Label>
          <NamedSelect
            id="finance-branch-filter"
            value={branchFilter}
            onChange={onBranchChange}
            options={branchOptions.map((b) => ({ value: b.slug, label: b.name }))}
          />
        </div>
      ) : null}
      <div className="finance-filter-group">
        <Label htmlFor="finance-preset-filter">Period</Label>
        <NamedSelect
          id="finance-preset-filter"
          value={datePreset}
          onChange={onDatePresetChange}
          options={DATE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>
      {datePreset === 'custom' ? (
        <>
          <div className="finance-filter-group">
            <Label htmlFor="finance-start">Start date</Label>
            <Input
              id="finance-start"
              type="date"
              value={customStart}
              onChange={(e) => onCustomRangeChange(e.target.value, customEnd)}
            />
          </div>
          <div className="finance-filter-group">
            <Label htmlFor="finance-end">End date</Label>
            <Input
              id="finance-end"
              type="date"
              value={customEnd}
              onChange={(e) => onCustomRangeChange(customStart, e.target.value)}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
