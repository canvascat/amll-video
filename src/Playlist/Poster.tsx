import { Img } from "remotion";
import { playerFontFamily } from "../Player/font";
import type { LyricPiece } from "./lattice/lyrics";

const collapsedShade =
  "linear-gradient(180deg, rgb(0 0 0 / 5%) 34%, rgb(0 0 0 / 24%) 56%, rgb(0 0 0 / 92%) 100%)";
const expandedShade =
  "linear-gradient(0deg, rgb(0 0 0 / 86%) 0%, rgb(0 0 0 / 62%) 14%, rgb(0 0 0 / 26%) 30%, rgb(0 0 0 / 0%) 46%), linear-gradient(90deg, rgb(0 0 0 / 88%), rgb(0 0 0 / 50%) 52%, rgb(0 0 0 / 8%))";

export const PlaylistPoster: React.FC<{
  coverUrl: string;
  title: string;
  artist: string;
  queueIndex: number;
  current: boolean;
  expanded: boolean;
  lyrics: LyricPiece[];
  showLyrics: boolean;
}> = ({ coverUrl, title, artist, queueIndex, current, expanded, lyrics, showLyrics }) => {
  const index = String(queueIndex + 1).padStart(2, "0");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "#111",
        color: "white",
        fontFamily: playerFontFamily,
      }}
    >
      {coverUrl ? (
        <Img
          src={coverUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: expanded ? expandedShade : collapsedShade,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          padding: "5px 8px",
          background: current ? "rgb(0 0 0 / 78%)" : "rgb(0 0 0 / 62%)",
          color: "white",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
        }}
      >
        {current ? `正在播放 · ${index}` : index}
      </div>
      <div style={{ position: "absolute", left: 17, right: 17, bottom: 17 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ opacity: 0.8 }}>{artist}</div>
      </div>
      {showLyrics ? (
        <div style={{ position: "absolute", left: 24, right: 24, top: 48, bottom: 72, overflow: "hidden" }}>
          {lyrics.map((piece, pieceIndex) => (
            <div
              key={`${piece.y}-${piece.x}-${pieceIndex}`}
              style={{
                position: "absolute",
                left: piece.x,
                top: piece.y,
                width: piece.width,
                height: piece.height,
                overflow: "hidden",
                color: "white",
                fontWeight: piece.translation ? 500 : 600,
                fontSize: piece.translation ? 16 : 32,
                lineHeight: `${piece.height}px`,
                opacity: piece.translation ? 0.8 : 1,
              }}
            >
              <span style={{ color: "rgb(255 255 255 / 35%)" }}>{piece.text}</span>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${piece.fill * 100}%`,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  color: "white",
                }}
              >
                {piece.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
