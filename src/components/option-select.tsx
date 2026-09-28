import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionSelectProps<T extends string> {
  id?: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  className?: string;
}

/** A single-choice Select over a fixed list; the trigger shows the option label, not the raw value. */
export function OptionSelect<T extends string>({ id, value, options, onChange, className }: OptionSelectProps<T>) {
  return (
    <Select items={options} value={value} onValueChange={(next) => next !== null && onChange(next)}>
      <SelectTrigger id={id} className={className ?? 'w-full'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
