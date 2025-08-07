import { v4 } from "uuid";
import { Random } from "roughjs/bin/math";

let random = new Random(Date.now());

export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export const reseed = seed => {
  random = new Random(seed);
};

export const randomId = () => v4();
