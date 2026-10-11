import logoImg from "../assets/logo.png";
import { cn } from "../utils/cn";

/** Endless Minesweeper logo mark. */
export function MineIcon({ className }: { className?: string }) {
  return (
    <img
      src={logoImg}
      alt=""
      aria-hidden="true"
      className={cn(
        "h-10 w-10 rounded-[6px] border-2 border-[#454d5b] bg-black object-cover shadow-sm",
        className,
      )}
    />
  );
}
