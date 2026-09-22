import Reveal from "./Reveal";

function StatsBar({ stats }) {
  return (
    <Reveal as="section" className="px-6 py-10 md:px-12 md:py-12">
      <div className="mx-auto max-w-5xl border-y border-[var(--border)]">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, index) => (
            <div
              key={s.label}
              className={`px-5 py-5 text-center md:py-6 ${index < stats.length - 1 ? "md:border-r md:border-[var(--border)]" : ""} ${index === 1 ? "border-r border-[var(--border)] md:border-r" : ""}`}
            >
              <p className="text-2xl font-bold tracking-tight text-[var(--accent-text)] md:text-3xl">
                {s.value}
              </p>
              <p className="mt-1.5 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

export default StatsBar;
