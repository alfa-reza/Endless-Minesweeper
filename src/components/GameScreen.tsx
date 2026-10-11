import { Home, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sfx } from "../game/audio";
import { Camera } from "../game/camera";
import { defaultCellSize, getBoardPalette, type Difficulty } from "../game/config";
import { Game, type GameEvent } from "../game/game";
import { EffectsPool } from "../game/renderer";
import { loadSave, patchSave, subscribeSave } from "../game/storage";
import { MobileZoomControls, ToolSwitch, ViewReadout } from "./Controls";
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

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return coarse;
}

export function GameScreen({ difficulty, seedLabel, onNewRound, onRetrySeed, onMenu }: Props) {
  const save = useSyncExternalStore(subscribeSave, loadSave);
  const coarse = useCoarsePointer();

  const [game] = useState(() => new Game(difficulty, seedLabel));
  const [camera] = useState(() => new Camera());
  const [effects] = useState(() => new EffectsPool());
  const hoverRef = useRef<Cell | null>(null);
  const hoverListeners = useRef(new Set<() => void>());
  const snap = useSyncExternalStore(game.subscribe, game.getSnapshot);

  const [overlay, setOverlay] = useState<Overlay>("none");
  const [tool, setTool] = useState<Tool>("dig");
  const [hurtKey, setHurtKey] = useState(0);

  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const saveRef = useRef(save);
  saveRef.current = save;

  const subscribeHover = useCallback((fn: () => void) => {
    hoverListeners.current.add(fn);
    return () => {
      hoverListeners.current.delete(fn);
    };
  }, []);

  const notifyHover = useCallback(() => {
    hoverListeners.current.forEach((fn) => fn());
  }, []);

  useEffect(() => () => game.dispose(), [game]);

  useEffect(() => {
    if (snap.status === "over") {
      sfx.setTension(0);
      return;
    }
    const lowLife = snap.lives === 1 && snap.maxLives > 1;
    const hardMode = difficulty.id === "hard" || difficulty.id === "insane";
    if (lowLife || (hardMode && snap.revealed > 80)) sfx.setTension(2);
    else if (hardMode || snap.revealed > 120) sfx.setTension(1);
    else sfx.setTension(0);
  }, [snap.status, snap.lives, snap.maxLives, snap.revealed, difficulty.id]);

  useEffect(() => {
    let overTimer = 0;
    game.onEvent = (e: GameEvent) => {
      const s = saveRef.current;
      const pal = getBoardPalette(s.highContrast);
      switch (e.type) {
        case "reveal":
          sfx.reveal(e.cells);
          if (!s.reduceMotion) {
            if (e.cells > 10) effects.spawnBurst(e.x + 0.5, e.y + 0.5, 14, pal.mint, 5.5);
            if (e.points > 0) effects.spawnPop(e.x + 0.5, e.y + 0.3, `+${e.points}`, pal.mint);
          }
          break;
        case "chord":
          sfx.chord();
          if (!s.reduceMotion) {
            effects.spawnBurst(e.x + 0.5, e.y + 0.5, 10, pal.accent, 4.5);
            if (e.points > 0) effects.spawnPop(e.x + 0.5, e.y + 0.3, `+${e.points}`, pal.accent);
          }
          break;
        case "flag":
          if (e.placed) sfx.flag();
          else sfx.unflag();
          break;
        case "boom":
          sfx.boom();
          if (!s.reduceMotion) {
            camera.addTrauma(e.livesLeft > 0 ? 0.55 : 0.9);
            effects.spawnBurst(e.x + 0.5, e.y + 0.5, 22, pal.danger, 7.5);
          }
          setHurtKey((k) => k + 1);
          if (s.haptics) navigator.vibrate?.(e.livesLeft > 0 ? 60 : [80, 40, 120]);
          camera.cancelFlight();
          break;
        case "gameover":
          sfx.gameOver();
          overTimer = window.setTimeout(() => {
            if (overlayRef.current === "none") setOverlay("over");
            if (e.record) window.setTimeout(() => sfx.record(), 450);
          }, 950);
          break;
      }
    };
    return () => {
      game.onEvent = null;
      window.clearTimeout(overTimer);
    };
  }, [game, camera, effects]);

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
    sfx.unlock();
    const next = !save.muted;
    sfx.muted = next;
    patchSave({ muted: next });
    if (!next) sfx.click();
  };

  const center = () => {
    sfx.click();
    camera.flyTo(0.5, 0.5, defaultCellSize(coarse));
  };

  const over = snap.status === "over";
  const inputEnabled = overlay === "none";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      {/* Board */}
      <GameCanvas
        game={game}
        camera={camera}
        tool={tool}
        inputEnabled={inputEnabled}
        coarse={coarse}
        longPressMs={save.longPressMs}
        haptics={save.haptics}
        highContrast={save.highContrast}
        reduceMotion={save.reduceMotion}
        hoverRef={hoverRef}
        effects={effects}
        onHoverChange={notifyHover}
        onPauseRequest={pause}
      />

      {/* Mine hit flash */}
      {hurtKey > 0 && (
        <div
          key={hurtKey}
          className="animate-hurt pointer-events-none absolute inset-0 bg-danger/20"
        />
      )}

      {/* Top HUD with full safe-area insets */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
        <div className="pointer-events-auto min-w-0">
          <StatsBar game={game} snap={snap} />
        </div>
        <div className="pointer-events-auto">
          <HudButtons
            muted={save.muted}
            onToggleMute={toggleMute}
            onCenter={center}
            onPause={pause}
            disablePause={over}
          />
        </div>
      </div>

      {/* Contextual banners */}
      {snap.status === "ready" && overlay === "none" && (
        <div className="animate-rise pointer-events-none absolute inset-x-0 top-[max(4.75rem,calc(env(safe-area-inset-top)+4rem))] flex justify-center px-4">
          <div className="surface rounded-xl px-3.5 py-2 text-center text-[13px] text-ink">
            <b className="text-mint">First click is safe.</b>{" "}
            <span className="text-muted">
              {coarse
                ? "Tap to dig · hold to flag · pinch to zoom"
                : "Click to dig · right-click to flag · drag to pan"}
            </span>
          </div>
        </div>
      )}

      {over && overlay === "none" && (
        <div className="animate-rise pointer-events-none absolute inset-x-0 top-[max(4.75rem,calc(env(safe-area-inset-top)+4rem))] flex justify-center px-4">
          <div className="surface pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 rounded-xl px-3.5 py-2">
            <span className="text-[13px] font-bold text-danger">Game over — spectating</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  sfx.click();
                  setOverlay("over");
                }}
              >
                Results
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  sfx.click();
                  onNewRound();
                }}
              >
                <RefreshCw size={15} aria-hidden="true" /> New round
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  sfx.click();
                  onMenu();
                }}
              >
                <Home size={15} aria-hidden="true" /> Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar with full safe-area insets */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]">
        <div className="pointer-events-auto hidden sm:block">
          <ViewReadout camera={camera} hoverRef={hoverRef} subscribeHover={subscribeHover} />
        </div>
        <div className="pointer-events-auto sm:hidden">
          <MobileZoomControls camera={camera} />
        </div>

        <div className="pointer-events-auto sm:absolute sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:-translate-x-1/2">
          {!over && <ToolSwitch tool={tool} onChange={setTool} />}
        </div>

        <div className="pointer-events-auto">
          <Minimap game={game} camera={camera} highContrast={save.highContrast} />
        </div>
      </div>

      {/* Modals */}
      {overlay === "pause" && (
        <PauseModal
          game={game}
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
