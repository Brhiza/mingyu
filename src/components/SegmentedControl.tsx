type SegmentedOption<T extends string | number | boolean> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string | number | boolean> = {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string | number | boolean>(
  props: SegmentedControlProps<T>,
) {
  const { value, options, onChange } = props;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const width = `${100 / options.length}%`;
  const left = `${(100 / options.length) * activeIndex}%`;

  return (
    <div className="workspace-ui-segmented">
      <div
        className="workspace-ui-segmented-indicator"
        style={{
          width,
          left,
        }}
      />
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`workspace-ui-segmented-item ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
