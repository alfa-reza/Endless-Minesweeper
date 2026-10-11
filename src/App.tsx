import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { StartMenu } from "./components/StartMenu";
import { sfx } from "./game/audio";
import { getDifficulty, type DifficultyId } from "./game/config";
import { randomSeedLabel } from "./game/seed";
import { loadSave } from "./game/storage";

sfx.muted = loadSave().muted;

interface Session {
  id: number;
  difficulty: DifficultyId;
  seed: string;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

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
