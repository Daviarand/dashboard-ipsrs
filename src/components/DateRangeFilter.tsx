import { useState, useEffect } from 'react';
import { getDatePresets, formatWIB, type DatePresetKey } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

export interface DateRangeValue {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  basis: 'reported' | 'finished';
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
  showBasisSelect?: boolean;
}

export function DateRangeFilter({
  value,
  onChange,
  showBasisSelect = true,
}: DateRangeFilterProps) {
  const presets = getDatePresets();
  const [activePreset, setActivePreset] = useState<DatePresetKey>('bulan_ini');
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  useEffect(() => {
    setCustomFrom(value.from);
    setCustomTo(value.to);
  }, [value.from, value.to]);

  const handlePresetClick = (key: DatePresetKey) => {
    setActivePreset(key);
    const preset = presets.find((p) => p.key === key);
    if (preset) {
      const range = preset.getRange();
      const fromStr = formatWIB(range.from, 'yyyy-MM-dd');
      const toStr = formatWIB(range.to, 'yyyy-MM-dd');
      setCustomFrom(fromStr);
      setCustomTo(toStr);
      onChange({
        ...value,
        from: fromStr,
        to: toStr,
      });
    }
  };

  const handleCustomApply = () => {
    setActivePreset('kustom');
    onChange({
      ...value,
      from: customFrom,
      to: customTo,
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="flex items-center text-xs font-medium text-slate-500 mr-1">
            <Calendar className="mr-1 h-3.5 w-3.5 text-slate-400" />
            Rentang:
          </span>
          {presets.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant={activePreset === preset.key ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handlePresetClick(preset.key)}
              className="text-xs h-7 px-2.5"
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Basis Acuan Tanggal */}
        {showBasisSelect && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Berdasarkan:</span>
            <Select
              value={value.basis}
              onChange={(e) =>
                onChange({ ...value, basis: e.target.value as 'reported' | 'finished' })
              }
              className="h-7 text-xs py-0 w-36"
            >
              <option value="reported">Tanggal Lapor</option>
              <option value="finished">Tanggal Selesai</option>
            </Select>
          </div>
        )}
      </div>

      {/* Custom Inputs */}
      {activePreset === 'kustom' && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500">Dari:</span>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-7 w-36 text-xs"
          />
          <span className="text-slate-500">Sampai:</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-7 w-36 text-xs"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCustomApply}
            className="h-7 px-3 text-xs"
          >
            Terapkan
          </Button>
        </div>
      )}
    </div>
  );
}
