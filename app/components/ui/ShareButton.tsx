import { Share, Check } from "lucide-react";
import { useState } from "react";

interface ShareButtonProps {
  text: string;
  label?: string;
}

export function ShareButton({ text, label }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 hover:bg-black hover:text-white p-1.5 transition-colors cursor-pointer"
      title={label || "Share"}
    >
      {copied ? <Check size={16} /> : <Share size={16} />}
    </button>
  );
}
