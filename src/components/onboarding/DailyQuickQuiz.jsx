import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { selectDailyQuestions } from "../../utils/quizEngine";

/**
 * One-question daily check-in. Question content is bundled locally; answering
 * never requires a network request. onComplete is called after the user has
 * seen immediate feedback and chooses to continue.
 */
export default function DailyQuickQuiz({ onComplete }) {
  const [question] = useState(() => selectDailyQuestions(1)[0]);
  const [selectedOption, setSelectedOption] = useState(null);

  if (!question) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-4">
        <p className="text-sm text-[var(--muted-foreground)]">Today's question isn't available right now.</p>
        <button type="button" onClick={onComplete} className="mt-3 rounded-lg bg-[var(--theme-primary,#2dd4bf)] px-4 py-2 text-sm font-semibold text-black">
          Continue to dashboard
        </button>
      </div>
    );
  }

  const answered = selectedOption !== null;
  const isCorrect = selectedOption === question.correctIndex;

  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {question.topic}
      </p>
      <h3 className="mb-5 pr-5 text-lg font-semibold leading-snug text-[var(--foreground)]">
        {question.question}
      </h3>
      <div className="space-y-2.5">
        {question.options.map((option, index) => {
          const isAnswer = index === question.correctIndex;
          const isPicked = index === selectedOption;
          let classes = "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]";
          if (answered && isAnswer) classes = "border-emerald-500/60 bg-emerald-500/10 text-[var(--foreground)]";
          else if (answered && isPicked) classes = "border-rose-500/60 bg-rose-500/10 text-[var(--foreground)]";
          else if (answered) classes = "border-[var(--border)] text-[var(--muted-foreground)]";

          return (
            <button
              key={`${question.id}-${index}`}
              type="button"
              disabled={answered}
              onClick={() => setSelectedOption(index)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-default ${classes}`}
            >
              <span>{option}</span>
              {answered && isAnswer && <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />}
              {answered && isPicked && !isAnswer && <XCircle size={18} className="shrink-0 text-rose-500" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4" aria-live="polite">
          <p className={`mb-1 flex items-center gap-2 text-sm font-semibold ${isCorrect ? "text-emerald-500" : "text-rose-500"}`}>
            {isCorrect ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
            {isCorrect ? "Correct" : "Not quite"}
          </p>
          <p className="text-sm text-[var(--foreground)]">
            Correct answer: <strong>{question.options[question.correctIndex]}</strong>
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            This is a core {question.topic} concept. Keep it in mind as you work through today's practice.
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="mt-4 w-full rounded-xl bg-[var(--theme-primary,#2dd4bf)] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Continue to dashboard
          </button>
        </div>
      )}
    </section>
  );
}
