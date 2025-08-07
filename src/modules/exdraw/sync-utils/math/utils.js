export const PRECISION = 10e-5;

export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};
