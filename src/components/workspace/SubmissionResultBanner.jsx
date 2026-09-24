import { useTheme } from "../../hooks/useTheme";
import { CheckCircle2, XCircle, Bomb, FileWarning, AlertTriangle } from "lucide-react";

// Per-theme flavor copy for each verdict. Only breakingBug/codeHeist have
// bespoke lines today — every other theme (and any future one) falls back
// to a neutral, still-on-brand message instead of silently inheriting
// codeHeist's "The Professor approves" text, which is what the previous
// binary ternary did.
const FLAVOR_MESSAGES = {
    breakingBug: {
        accepted: "Batch purity confirmed.",
        wrongAnswer: "Impurities detected in the batch.",
        runtimeError: "The cook exploded unexpectedly.",
        compileError: "The recipe is incomplete.",
    },
    codeHeist: {
        accepted: "The Professor approves. Target secured.",
        wrongAnswer: "The alarm system detected a flaw in the plan.",
        runtimeError: "The escape route failed.",
        compileError: "The Professor rejected the plan.",
    },
    ghostProtocol: {
        accepted: "Trace cleared. Payload verified.",
        wrongAnswer: "Trace exposed a mismatch in the payload.",
        runtimeError: "The process dropped from the network.",
        compileError: "The payload could not be compiled.",
    },
    survivalCode: {
        accepted: "Round cleared. You stay in the game.",
        wrongAnswer: "This round exposed a weakness.",
        runtimeError: "The run crashed under pressure.",
        compileError: "The build failed before the round began.",
    },
    debugDynasty: {
        accepted: "Build verified. Release is green.",
        wrongAnswer: "Verification found a failing case.",
        runtimeError: "The build crashed at runtime.",
        compileError: "The build pipeline rejected the code.",
    },
};

const DEFAULT_FLAVOR = {
    accepted: "All test cases passed.",
    wrongAnswer: "Output didn't match on at least one test case.",
    runtimeError: "The program crashed during execution.",
    compileError: "The code didn't compile.",
};

export default function SubmissionResultBanner({
    submitInfo,
}) {
    const { theme } = useTheme();

    if (!submitInfo?.status) {
        return null;
    }

    const flavor = FLAVOR_MESSAGES[theme.id] || DEFAULT_FLAVOR;

    const isAccepted =
        submitInfo.status.includes("Accepted");

    const isWrongAnswer =
        submitInfo.status.includes("Wrong Answer");

    const isRuntime =
        submitInfo.status.includes("Runtime");

    const isCompile =
        submitInfo.status.includes("Compilation");

    const meta = isAccepted
        ? {
            Icon: CheckCircle2,
            title: theme.words.accepted,
            message: flavor.accepted,
            classes:
                "border-verdict-accept/30 bg-verdict-accept/10 text-verdict-accept",
        }
        : isWrongAnswer
            ? {
                Icon: XCircle,
                title: theme.words.wrongAnswer,
                message: flavor.wrongAnswer,
                classes:
                    "border-verdict-reject/30 bg-verdict-reject/10 text-verdict-reject",
            }
            : isRuntime
                ? {
                    Icon: Bomb,
                    title: theme.words.runtimeError,
                    message: flavor.runtimeError,
                    classes:
                        "border-verdict-reject/30 bg-verdict-reject/10 text-verdict-reject",
                }
                : isCompile
                    ? {
                        Icon: FileWarning,
                        title: theme.words.compileError,
                        message: flavor.compileError,
                        classes:
                            "border-verdict-pending/30 bg-verdict-pending/10 text-verdict-pending",
                    }
                    : {
                        Icon: AlertTriangle,
                        title: theme.words.judgeError,
                        message:
                            "The evaluation system encountered an issue.",
                        classes:
                            "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)]",
                    };

    return (
        <div
            data-universe-result={isAccepted ? "accepted" : isWrongAnswer ? "wrong-answer" : isRuntime ? "runtime-error" : isCompile ? "compile-error" : "judge-error"}
            className={`universe-result-banner
    mb-4 rounded-2xl border p-4
    animate-[fadeIn_.25s_ease-out]
    ${isAccepted
                    ? "animate-[pulseGlow_1s_ease-out]"
                    : ""
                }
    ${meta.classes}
`}
        >
            <h3 className="font-bold text-lg flex items-center gap-2">
                <meta.Icon size={20} strokeWidth={2} aria-hidden="true" />
                <span>{meta.title}</span>
            </h3>

            <p className="text-sm mt-1 opacity-90">
                {meta.message}
            </p>

            {submitInfo.passed !== undefined &&
                submitInfo.total !== undefined && (
                    <p className="text-xs mt-2 opacity-70">
                        {submitInfo.passed}/{submitInfo.total} testcases passed
                    </p>
                )}

            {/* Wrong-answer encouragement (Submission Experience, Feature 2).
                Server-picked, deduped against the student's last attempt on
                this problem — see backend/utils/encouragementMessages.js.
                Deliberately never present for Accepted (that verdict gets
                its own celebration — see SubmissionCelebrationModal). */}
            {!isAccepted && submitInfo.encouragementMessage && (
                <p className="text-xs mt-2 pt-2 border-t border-white/10 opacity-80 italic">
                    {submitInfo.encouragementMessage}
                </p>
            )}
        </div>
    );
}