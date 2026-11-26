export function CompareScale({ size }: { size: number }) {
  return (
    <svg className="cc-compare-scale" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v17m-5 1h10M3 7l9-2 9 2M5.5 7l-3.5 7h7zM18.5 7L15 14h7z" />
      <path d="M2 14q3.5 5 7 0m6 0q3.5 5 7 0" />
    </svg>
  );
}
