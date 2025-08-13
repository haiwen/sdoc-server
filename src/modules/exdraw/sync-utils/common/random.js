import { v4 } from "uuid";

class Random {
  constructor(seed) {
    this.seed = seed;
  }

  next = () => {
    if (this.seed) {
      return ((2 ** 31 - 1) & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31;
    } else {
      return Math.Random();
    }
  };
}

let random = new Random(Date.now());

export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export const reseed = seed => {
  random = new Random(seed);
};

export const randomId = () => v4();
