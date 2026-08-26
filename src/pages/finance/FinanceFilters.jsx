/** Shared Finance filter bar: branch + period + custom range + compare + refresh.
 * Sticky books strip so every tab shares one accurate window. */
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Separator } from '@/components/ui/separator'
import { COMPARE_PRESETS, DATE_PRESETS } from '@/lib/financeData'

export default function FinanceFilters({
  branchOptions,
  branchFilter,
  onBranchChange,
  datePreset,
  onDatePresetChange,
  customStart,
  customEnd,
  onCustomRangeChange,
  comparePreset = 'none',
  onCompareChange,
  showCompare = true,
  showBranch = true,
  onRefresh,
  refreshing = false,
  windowLabel = '',
}) {
  const showCustom = datePreset === 'custom'

  return (
    <div className="finance-filters" role="search" aria-label="Finance filters">
      <div className="finance-filters-meta">
        <p className="finance-filters-kicker">Reporting window</p>
        <p className="finance-filters-window tabular-nums">{windowLabel || '—'}</p>
      </div>

      <Separator orientation="vertical" className="finance-filters-rule hidden md:block" />

      <div className="finance-filters-controls">
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

        {showCustom ? (
          <>
            <div className="finance-filter-group">
              <Label htmlFor="finance-start">From</Label>
              <Input
                id="finance-start"
                type="date"
                value={customStart}
                onChange={(e) => onCustomRangeChange(e.target.value, customEnd)}
                className="min-h-10"
              />
            </div>
            <div className="finance-filter-group">
              <Label htmlFor="finance-end">To</Label>
              <Input
                id="finance-end"
                type="date"
                value={customEnd}
                onChange={(e) => onCustomRangeChange(customStart, e.target.value)}
                className="min-h-10"
              />
            </div>
          </>
        ) : null}

        {showCompare && onCompareChange ? (
          <div className="finance-filter-group">
            <Label htmlFor="finance-compare-filter">Compare</Label>
            <NamedSelect
              id="finance-compare-filter"
              value={comparePreset}
              onChange={onCompareChange}
              options={COMPARE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            />
          </div>
        ) : null}
      </div>

      {onRefresh ? (
        <div className="finance-filters-actions">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 cursor-pointer"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh finance data"
          >
            <RefreshCw data-icon="inline-start" className={refreshing ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>
      ) : null}
    </div>
  )
}
