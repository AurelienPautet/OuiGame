// Per-round counters. snake_case `blocks_destroyed` is load-bearing (it reaches
// the wire as-is and is read back by the stats repo).
export interface StatsCounters {
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  plants: number;
  blocks_destroyed: number;
}

function emptyCounters(): StatsCounters {
  return {
    wins: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    plants: 0,
    blocks_destroyed: 0,
  };
}

export class Stats {
  stats: StatsCounters;

  constructor() {
    this.stats = emptyCounters();
  }

  reset(): void {
    this.stats = emptyCounters();
  }
}
