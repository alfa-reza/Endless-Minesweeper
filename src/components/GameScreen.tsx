import { Home, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sfx } from "../game/audio";
import { Camera } from "../game/camera";
import { DEFAULT_CELL, type Difficulty } from "../game/config";
import { Game, type GameEvent } from "../game/game";
import { patchSave } from "../game/storage";
import { ToolSwitch, ViewReadout } from "./Controls";
import { GameCanvas, type Cell, type Tool } from "./GameCanvas";
import { GameOverModal } from "./GameOverModal";
import { HelpModal } from "./HelpModal";
import { HudButtons, StatsBar } from "./Hud";
import { Minimap } from "./Minimap";
import { PauseModal } from "./PauseModal";

interface Props {
  difficulty: Difficulty;
  seedLabel: string;
  onNewRound: () => void;
  onRetrySeed: () => void;
  onMenu: () => void;
}

type Overlay = "none" | "pause" | "help" | "over";

export function GameScreen({ difficulty, seedLabel, onNewRound, onRetrySeed, onMenu }: Props) {
  const [game] = useState(() => new Game(difficulty, seedLabel));
  const [camera] = useState(() => new Camera());
  const hoverRef = useRef<Cell | null>(null);
  const snap = useSyncExternalStore(game.subscribe, game.getSnapshot);

  const [overlay, setOverlay] = useState<Overlay>("none");
  const [tool, setTool] = useState<Tool>("dig");
  const [muted, setMuted] = useState(sfx.muted);
  const [shake, setShake] = useState(false);
  const [hurtKey, setHurtKey] = useState(0);
  const [coarse] = useState(() => window.matchMedia("(pointer: coarse)").matches);

  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  // ---- lifecycle ----
  useEffect(() => () => game.dispose(), [game]);

  // ---- game events -> sound, juice and the game-over modal ----
  useEffect(() => {
    let overTimer = 0;
    let shakeTimer = 0;
    game.onEvent = (e: GameEvent) => {
      switch (e.type) {
        case "reveal":
          sfx.reveal(e.cells);
          break;
        case "chord":
          sfx.chord();
          break;
        case "flag":
          if (e.placed) sfx.flag();
          else sfx.unflag();
          break;
        case "boom":
          sfx.boom();
          setShake(true);
          setHurtKey((k) => k + 1);
          window.clearTimeout(shakeTimer);
          shakeTimer = window.setTimeout(() => setShake(false), 480);
          navigator.vibrate?.(e.livesLeft > 0 ? 60 : [80, 40, 120]);
          // keep the camera on the blast
          camera.cancelFlight();
          break;
        case "gameover":
          sfx.gameOver();
          overTimer = window.setTimeout(() => {
            if (overlayRef.current === "none") setOverlay("over");
            if (e.record) window.setTimeout(() => sfx.record(), 500);
          }, 1100);
          break;
      }
    };
    return () => {
      game.onEvent = null;
      window.clearTimeout(overTimer);
      window.clearTimeout(shakeTimer);
    };
  }, [game, camera]);

  // ---- pause handling ----
  const pause = useCallback(() => {
    if (game.isOver() || overlayRef.current !== "none") return;
    game.pause();
    setOverlay("pause");
  }, [game]);

  const resume = useCallback(() => {
    game.resume();
    setOverlay("none");
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key.toLowerCase() === "p") && !e.repeat && overlayRef.current === "none") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        pause();
      }
    };
    const onVis = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pause]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sfx.muted = next;
    patchSave({ muted: next });
    if (!next) sfx.click();
  };

  const center = () => camera.flyTo(0.5, 0.5, DEFAULT_CELL);
  const over = snap.status === "over";
  const inputEnabled = overlay === "none";

  return (
    <div className="relative h-full w-full overflow-hidden bg-night">
      {/* Board */}
      <div className={shake ? "animate-shake absolute inset-0" : "absolute inset-0"}>
        <GameCanvas game={game} camera={camera} tool={tool} inputEnabled={inputEnabled} hoverRef={hoverRef} />
      </div>

      {/* Atmosphere */}
      <div className="fog-fx opacity-70">
        <i />
      </div>
      <div className="vignette" />
      {hurtKey > 0 && (
        <div
          key={hurtKey}
          className="animate-hurt pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,60,70,0.05)_30%,rgba(255,40,60,0.55)_100%)]"
        />
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto min-w-0">
          <StatsBar game={game} snap={snap} />
        </div>
        <div className="pointer-events-auto">
          <HudButtons
            muted={muted}
            onToggleMute={toggleMute}
            onCenter={center}
            onHelp={() => {
              game.pause();
              setOverlay("help");
            }}
            onPause={pause}
            disablePause={over}
          />
        </div>
      </div>

      {/* Contextual banners */}
      {snap.status === "ready" && overlay === "none" && (
        <div className="animate-rise pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
          <div className="glass rounded-2xl px-4 py-2.5 text-center text-[13px] text-ink/90">
            <b className="text-mint">Your first click is always safe.</b>{" "}
            <span className="text-muted/80">
              {coarse ? "Tap to dig · long-press to flag · pinch to zoom" : "Click to dig · right-click to flag · drag to pan"}
            </span>
          </div>
        </div>
      )}
      {over && overlay === "none" && (
        <div className="animate-rise absolute inset-x-0 top-20 flex justify-center px-4">
          <div className="glass flex flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-2.5">
            <span className="text-[13px] font-semibold text-danger">Game over — spectating</span>
            <div className="flex gap-2">
              <button className="btn !px-3 !py-1.5" onClick={() => setOverlay("over")}>
                Results
              </button>
              <button className="btn btn-primary !px-3 !py-1.5" onClick={onNewRound}>
                <RefreshCw size={14} /> New round
              </button>
              <button className="btn !px-3 !py-1.5" onClick={onMenu}>
                <Home size={14} /> Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto hidden sm:block">
          <ViewReadout camera={camera} hoverRef={hoverRef} />
        </div>
        <div className="pointer-events-auto sm:absolute sm:bottom-3 sm:left-1/2 sm:-translate-x-1/2">
          {!over && <ToolSwitch tool={tool} onChange={setTool} />}
        </div>
        <div className="pointer-events-auto ml-auto">
          <Minimap game={game} camera={camera} />
        </div>
      </div>

      {/* Modals */}
      {overlay === "pause" && (
        <PauseModal
          game={game}
          muted={muted}
          onToggleMute={toggleMute}
          onResume={resume}
          onHelp={() => setOverlay("help")}
          onNewRound={onNewRound}
          onRetrySeed={onRetrySeed}
          onMenu={onMenu}
        />
      )}
      {overlay === "help" && (
        <HelpModal onClose={() => (game.isOver() ? setOverlay("none") : setOverlay("pause"))} />
      )}
      {overlay === "over" && (
        <GameOverModal
          game={game}
          snap={snap}
          onNewRound={onNewRound}
          onRetrySeed={onRetrySeed}
          onSpectate={() => setOverlay("none")}
          onMenu={onMenu}
        />
      )}
    </div>
  );
}
