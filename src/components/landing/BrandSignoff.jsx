import { CheckCircle2, Code2 } from "lucide-react";
import Reveal from "./Reveal";

function BrandSignoff() {
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-16">
      <Reveal className="border-y border-[var(--border)] py-12 text-center md:py-14">
        <div className="inline-flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-verdict-accept/10 text-[var(--accent-text)]"
            aria-hidden="true"
          >
            <Code2 size={21} strokeWidth={2} />
          </span>
          <h2 className="font-display text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl md:text-6xl">
            Code Club<span className="text-[var(--accent-text)]">.</span>
          </h2>
        </div>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Where solved problems compile into proof.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 font-mono-ui text-xs font-semibold text-[var(--accent-text)]">
          <CheckCircle2 size={14} strokeWidth={2.4} aria-hidden="true" />
          Accepted.
        </div>
      </Reveal>
    </section>
  );
}

export default BrandSignoff;
