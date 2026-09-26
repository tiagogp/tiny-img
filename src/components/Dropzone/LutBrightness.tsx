import { helpText } from "./settingsStyles";

export default function LutBrightness({
  id, value, onChange, disabled = false,
}: {
  id: string;
  value: number;
  onChange(value: number): void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6">
      <label htmlFor={id} className="flex items-baseline justify-between gap-4 text-body-sm font-medium text-primary">
        Brightness
        <span data-numeric className="font-mono text-caption text-secondary">
          {Math.round(value * 100)}%
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={50}
        max={200}
        step={1}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="mt-5 w-full cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45"
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className={helpText}>
        Adjusts brightness after the LUT. 100% keeps it unchanged.
      </p>
    </div>
  );
}
