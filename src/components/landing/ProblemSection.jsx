import Reveal from "./Reveal";

const PROBLEMS = [
  {
    index: "01",
    title: "Verified",
    detail: "Accepted solutions are tested against hidden test cases.",
  },
  {
    index: "02",
    title: "Provable",
    detail: "A student's profile reflects demonstrated problem-solving, not self-reported claims.",
  },
  {
    index: "03",
    title: "Discoverable",
    detail: "Demonstrated problem-solving can become part of a student's technical identity.",
  },
];

function ProblemSection() {
  return (
    <Reveal as="section" className="px-6 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-start md:gap-20">
          <div className="md:sticky md:top-28">
            <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
              The problem
            </p>
            <h2 className="text-lp-h2-spine font-display font-bold tracking-tight text-[var(--foreground)]">
              Anyone can say they solved it.
              <br />
              Proving it is different.
            </h2>
            <p className="mt-5 max-w-sm leading-relaxed text-[var(--muted-foreground)]">
              Practice only becomes useful when there is evidence behind it.
            </p>
          </div>

          <div className="border-t border-[var(--border)]">
            {PROBLEMS.map((p) => (
              <div
                key={p.index}
                className="grid grid-cols-[52px_1fr] gap-5 border-b border-[var(--border)] py-7"
              >
                <span className="font-mono-ui text-xs text-[var(--accent-text)]">
                  {p.index}
                </span>
                <div>
                  <p className="text-xl font-display font-semibold text-[var(--foreground)]">
                    {p.title}
                  </p>
                  <p className="mt-2 max-w-lg leading-relaxed text-[var(--muted-foreground)]">
                    {p.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default ProblemSection;
