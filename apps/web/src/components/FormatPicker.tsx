import { useId } from "react";

export interface FormatOption<T extends string = string> {
  id: T;
  label: string;
  /** Where it's used: the pill's title. */
  usedBy: string;
}

/** The legend over a tool's output choice, the same on every tool. */
export const WHERE_IT_GOES = "Where it goes";

interface Props<T extends string> {
  options: FormatOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  /** More pills in the same row, such as a Toggle that goes with the choice. */
  children?: React.ReactNode;
}

/** A row of pills choosing one option: real radio buttons, so arrow keys work. */
export function FormatPicker<T extends string>({
  options,
  value,
  onChange,
  label = WHERE_IT_GOES,
  children,
}: Props<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className="label mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.id} title={o.usedBy} className="button compact choice">
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            />
            {o.label}
          </label>
        ))}
        {children}
      </div>
    </fieldset>
  );
}

/** An on/off pill: a real checkbox. For one of several options, use FormatPicker. */
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
    <label className="button compact choice">
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
