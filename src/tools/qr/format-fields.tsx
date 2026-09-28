import { cn } from 'cn';
import { useId } from 'react';

import { OptionSelect } from '@/components/option-select';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { FieldDef, Values } from '@/tools/qr/formats';

interface FormatFieldsProps {
  fields: FieldDef[];
  values: Values;
  onChange: (name: string, value: string) => void;
}

function FieldControl({
  field,
  id,
  value,
  onChange,
}: {
  field: FieldDef;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  switch (field.kind) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="max-h-72 min-h-28"
        />
      );
    case 'select':
      return <OptionSelect id={id} value={value} options={field.options ?? []} onChange={onChange} />;
    case 'switch':
      return <Switch id={id} checked={value === 'true'} onCheckedChange={(checked) => onChange(String(checked))} />;
    default:
      return (
        <Input
          id={id}
          type={field.kind === 'datetime' ? 'datetime-local' : field.kind === 'password' ? 'password' : 'text'}
          value={value}
          placeholder={field.placeholder}
          inputMode={field.inputMode}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

export function FormatFields({ fields, values, onChange }: FormatFieldsProps) {
  const prefix = useId();

  return (
    <div className="@container">
      <div className="grid gap-4 @sm:grid-cols-2">
        {fields.map((field) => {
          const id = `${prefix}-${field.name}`;
          const control = (
            <FieldControl
              field={field}
              id={id}
              value={values[field.name] ?? ''}
              onChange={(value) => onChange(field.name, value)}
            />
          );
          if (field.kind === 'switch') {
            return (
              <Field
                key={field.name}
                orientation="horizontal"
                className={cn('self-end', field.wide && '@sm:col-span-2')}
              >
                <FieldContent>
                  <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
                  {field.description && <FieldDescription>{field.description}</FieldDescription>}
                </FieldContent>
                {control}
              </Field>
            );
          }
          return (
            <Field key={field.name} className={cn(field.wide && '@sm:col-span-2')}>
              <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
              {control}
              {field.description && <FieldDescription>{field.description}</FieldDescription>}
            </Field>
          );
        })}
      </div>
    </div>
  );
}
