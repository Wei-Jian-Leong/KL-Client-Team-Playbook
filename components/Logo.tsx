import { tarroLogoSrc } from "@/lib/tarro-logo";

export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tarroLogoSrc}
        alt="Tarro"
        width={22}
        height={33}
        className="object-contain"
      />
      <span className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
        KL Client Team<br />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Playbook</span>
      </span>
    </span>
  );
}
