import SectionCard from "../../ui/layout/SectionCard";
import Button from "../../ui/Button";
import { useAppContext } from "../../../hooks/useAppContext";
import { PlayCircle } from "lucide-react";

function ContinueLearningSection() {
  const { submissions } = useAppContext();

  // Backend (/api/init) returns submissions sorted newest-first
  // (Submission.find().sort({ createdAt: -1 })) — index 0 is the most
  // recent attempt, not the last index.
  const latestSubmission =
    submissions?.length > 0
      ? submissions[0]
      : null;


  if (!latestSubmission) {
    return (
      <SectionCard
        title="Continue Learning"
        subtitle="Start your journey"
        icon={<PlayCircle size={18} strokeWidth={2} />}
        accented
      >
        <p className="text-[var(--muted-foreground)] mb-6">
          You haven't solved any problems yet.
          Begin with your first challenge.
        </p>

        <Button to="/problems" variant="theme">
          Explore Problems
        </Button>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Continue Learning"
      subtitle="Pick up where you left off"
      icon={<PlayCircle size={18} strokeWidth={2} />}
      accented
    >
      <h3 className="text-xl font-bold line-clamp-2" title={latestSubmission.problemTitle}>
        {latestSubmission.problemTitle}
      </h3>

      <p className="text-[var(--muted-foreground)] mt-2 mb-6">
        Last attempt:{" "}
        <span
          className={`font-medium ${latestSubmission.status === "Accepted"
            ? "text-green-400"
            : "text-red-400"
            }`}
        >
          {latestSubmission.status}
        </span>
      </p>

      <Button to={`/problems/${latestSubmission.problemSlug ?? latestSubmission.problemId}`} variant="theme">
        Continue →
      </Button>
    </SectionCard>
  );
}

export default ContinueLearningSection;