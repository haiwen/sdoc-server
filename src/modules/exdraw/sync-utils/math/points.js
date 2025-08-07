import { PRECISION } from "./utils";

export function pointsEqual(a, b, tolerance = PRECISION) {
  const abs = Math.abs;
  return abs(a[0] - b[0]) < tolerance && abs(a[1] - b[1]) < tolerance;
}

export function pointFrom(x, y) {
  return [x, y];
}

export function pointTranslate(p, v = [0, 0]) {
  return pointFrom(p[0] + v[0], p[1] + v[1]);
}

export const getSizeFromPoints = points => {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
};



