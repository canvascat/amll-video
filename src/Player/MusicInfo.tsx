import type { FC } from "react";

export const MusicInfo: FC<{
  songName: string;
  artistName: string;
  className?: string;
}> = ({ songName, artistName, className }) => {
  return (
    <div
      className={`min-w-0 text-white text-[length:max(2vh,1em)] leading-[1.25em] ${className ?? ""}`}
    >
      <div className="min-w-0 truncate font-medium tracking-[0.4px] opacity-90">
        {songName}
      </div>
      <div className="truncate font-normal tracking-[0.4px] opacity-45">
        {artistName}
      </div>
    </div>
  );
};
