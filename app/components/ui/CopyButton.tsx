import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 hover:bg-black hover:text-white p-1.5 transition-colors cursor-pointer"
      title={label || "Copy"}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}
