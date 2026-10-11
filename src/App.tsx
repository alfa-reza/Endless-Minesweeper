import { useEffect, useState, useSyncExternalStore } from "react";
import { GameScreen } from "./components/GameScreen";
import { StartMenu } from "./components/StartMenu";
import { sfx } from "./game/audio";
import { getDifficulty, type DifficultyId } from "./game/config";
import { randomSeedLabel } from "./game/seed";
import { loadSave, subscribeSave } from "./game/storage";

interface Session {
  id: number;
  difficulty: DifficultyId;
  seed: string;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const save = useSyncExternalStore(subscribeSave, loadSave);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = save.reduceMotion ? "true" : "false";
  }, [save.reduceMotion]);

  useEffect(() => {
    sfx.muted = save.muted;
    sfx.setMusicVolume(save.musicVolume);
    sfx.setSfxVolume(save.sfxVolume);
  }, [save.muted, save.musicVolume, save.sfxVolume]);

  useEffect(() => {
    sfx.setMusicMode(session ? "playing" : "menu");
    if (!session) sfx.setTension(0);
  }, [session]);

  if (!session) {
    return (
      <StartMenu
        onPlay={(difficulty, seed) => setSession({ id: Date.now(), difficulty, seed })}
      />
    );
  }

  return (
    <GameScreen
      key={session.id}
      difficulty={getDifficulty(session.difficulty)}
      seedLabel={session.seed}
      onNewRound={() => setSession({ ...session, id: Date.now(), seed: randomSeedLabel() })}
      onRetrySeed={() => setSession({ ...session, id: Date.now() })}
      onMenu={() => setSession(null)}
    />
  );
}
