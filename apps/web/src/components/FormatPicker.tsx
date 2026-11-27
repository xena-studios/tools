import { OUTPUT_FORMATS, type OutputFormat } from "@xena-tools/mc-text";

export interface FormatOption<T extends string = string> {
  id: T;
  label: string;
  usedBy: string;
}

export const TEXT_FORMATS: FormatOption<OutputFormat>[] = OUTPUT_FORMATS.map((f) => ({
  id: f.id,
  label: f.label,
  usedBy: f.usedBy,
}));

export const isOutputFormat = (v: string | null): v is OutputFormat =>
  OUTPUT_FORMATS.some((f) => f.id === v);

interface Props<T extends string> {
  options: FormatOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

/** A row of pills choosing the output format. */
export function FormatPicker<T extends string>({
  options,
  value,
  onChange,
  label = "Format",
}: Props<T>) {
  return (
    <fieldset>
      <legend className="label mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.id}
            title={o.usedBy}
            className="btn has-checked:border-accent has-checked:bg-accent/20 has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              className="sr-only"
              name={label}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="btn has-checked:border-accent has-checked:bg-accent/20 has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
