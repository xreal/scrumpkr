import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { DECK, type CardValue } from "~/lib/deck";
import {
  getPresenterVoteHint,
  isPresenterVotePrefix,
  parsePresenterVoteInput,
  shouldIgnorePresenterKeyTarget,
} from "~/lib/presenter-vote";

const DECOY_DIGITS = ["0", "0"] as const;

type PresenterInputState = "idle" | "typing" | "confirmed";

interface PresenterDigitDisplayProps {
  state: PresenterInputState;
  variant?: "input" | "overlay";
}

function PresenterVoteCheckmark({
  testId = "presenter-vote-checkmark",
  size = "md",
}: {
  testId?: string;
  size?: "md" | "lg";
}) {
  const boxClass =
    size === "lg"
      ? "h-14 w-14 sm:h-16 sm:w-16"
      : "h-12 w-12 sm:h-14 sm:w-14";
  const iconSize = size === "lg" ? 28 : 24;

  return (
    <span
      data-testid={testId}
      className={`flex ${boxClass} items-center justify-center border-2 border-black bg-black text-white`}
    >
      <Check size={iconSize} strokeWidth={3} />
    </span>
  );
}

function PresenterDigitDisplay({ state, variant = "input" }: PresenterDigitDisplayProps) {
  if (state === "confirmed" || variant === "overlay") {
    return (
      <div className="flex justify-center">
        <PresenterVoteCheckmark
          testId={variant === "overlay" ? "presenter-overlay-checkmark" : "presenter-vote-checkmark"}
          size={variant === "overlay" ? "lg" : "md"}
        />
      </div>
    );
  }

  const slots = state === "typing" ? ["•", "•"] : [...DECOY_DIGITS];

  return (
    <div className="flex items-center gap-2">
      {slots.map((digit, index) => (
        <span
          key={`${state}-${index}`}
          data-testid={`presenter-digit-${index}`}
          className={`flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center border-2 border-black text-xl sm:text-2xl font-black transition-colors ${
            state === "typing" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          {digit}
        </span>
      ))}
    </div>
  );
}

interface PresenterVotingProps {
  revealed: boolean;
  hasVoted: boolean;
  myVote: string | null;
  onVote: (value: CardValue) => void;
  onClearVote: () => void;
}

export function PresenterVoting({
  revealed,
  hasVoted,
  myVote,
  onVote,
  onClearVote,
}: PresenterVotingProps) {
  const [buffer, setBuffer] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasVoted) {
      return;
    }
    setBuffer("");
    setInputError(null);
  }, [hasVoted]);

  const submitVote = useCallback(
    (rawInput: string) => {
      const parsedVote = parsePresenterVoteInput(rawInput);
      if (!parsedVote) {
        setInputError("Not a valid estimate");
        return;
      }

      setInputError(null);
      setBuffer("");
      onVote(parsedVote);
    },
    [onVote]
  );

  useEffect(() => {
    if (revealed) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (shouldIgnorePresenterKeyTarget(event.target)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (buffer.trim()) {
          submitVote(buffer);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setBuffer("");
        setInputError(null);
        if (hasVoted) {
          onClearVote();
        }
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setBuffer((current) => current.slice(0, -1));
        setInputError(null);
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        submitVote("?");
        return;
      }

      if (event.key === "." && buffer === "0") {
        event.preventDefault();
        setBuffer("0.");
        setInputError(null);
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        const nextBuffer = `${buffer}${event.key}`;
        if (!isPresenterVotePrefix(nextBuffer)) {
          setInputError("Not a valid estimate");
          return;
        }
        setBuffer(nextBuffer);
        setInputError(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buffer, revealed, submitVote, hasVoted, onClearVote]);

  const hint = getPresenterVoteHint(buffer);
  const isTyping = buffer.length > 0;
  const showVotedOverlay = hasVoted && !revealed && !isTyping;
  const inputState: PresenterInputState = showVotedOverlay
    ? "confirmed"
    : isTyping
      ? "typing"
      : "idle";
  const statusLabel =
    inputState === "confirmed"
      ? "Vote recorded"
      : inputState === "typing"
        ? "Typing estimate"
        : "Waiting for estimate";

  return (
    <div className="relative space-y-4">
      <div
        className={`grid grid-cols-5 gap-2 sm:gap-3 transition-all ${
          showVotedOverlay ? "blur-sm opacity-60 pointer-events-none select-none" : ""
        }`}
        aria-hidden={showVotedOverlay}
      >
        {DECK.map((card) => {
          const isSelected = revealed && myVote === card;

          return (
            <div
              key={card}
              className={`relative h-14 sm:h-16 md:h-20 w-full flex items-center justify-center border-2 border-black text-xl sm:text-2xl font-black ${
                isSelected
                  ? "bg-black text-white"
                  : "bg-white text-black/40 blur-[2px]"
              }`}
            >
              {isSelected ? (
                <>
                  {card}
                  <span className="absolute top-1 right-1">
                    <Check size={14} strokeWidth={3} className="text-white sm:w-4 sm:h-4" />
                  </span>
                </>
              ) : (
                <span className="opacity-50">{card}</span>
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <div
          className={`border-2 p-4 sm:p-5 space-y-3 transition-colors ${
            showVotedOverlay
              ? "border-black blur-sm opacity-60"
              : isTyping
                ? "border-black bg-white"
                : "border-black bg-gray-50"
          }`}
        >
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-600">
            Type your estimate
          </p>
          <div className="flex items-center justify-between gap-4 min-h-14">
            <div aria-live="polite" aria-label={statusLabel}>
              <PresenterDigitDisplay state={inputState} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 text-right shrink-0">
              Enter ↵
            </p>
          </div>
          <p
            className={`text-sm font-medium ${inputError ? "text-red-600" : "text-gray-600"}`}
            role="status"
          >
            {inputError || hint || "Use number keys · ? for unknown · Esc to clear"}
          </p>
        </div>
      ) : null}

      {showVotedOverlay ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md border-2 border-black bg-white px-6 py-8 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500 mb-2">
              Estimate hidden
            </p>
            <div className="mx-auto mb-4">
              <PresenterDigitDisplay state="confirmed" variant="overlay" />
            </div>
            <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight">You voted</p>
            <p className="mt-3 text-sm font-medium text-gray-600">
              Use Esc to change your vote before reveal.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
