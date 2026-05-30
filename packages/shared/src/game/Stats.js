export class Stats {
  constructor() {
    this.stats = {
      wins: 0,
      kills: 0,
      deaths: 0,
      shots: 0,
      hits: 0,
      plants: 0,
      blocks_destroyed: 0,
    };
  }

  reset() {
    this.stats = {
      wins: 0,
      kills: 0,
      deaths: 0,
      shots: 0,
      hits: 0,
      plants: 0,
      blocks_destroyed: 0,
    };
  }
}
