export function vector(x, y, originX = 0, originY = 0) {
  return [x - originX, y - originY];
}


export function vectorScale(v, scalar) {
  return vector(v[0] * scalar, v[1] * scalar);
}

export function vectorFromPoint(
  p,
  origin = [0, 0],
  threshold,
  defaultValue = [0, 1]
) {
  const vec = vector(p[0] - origin[0], p[1] - origin[1]);

  if (threshold && vectorMagnitudeSq(vec) < threshold * threshold) {
    return defaultValue;
  }

  return vec;
}

export function vectorMagnitudeSq(v) {
  return v[0] * v[0] + v[1] * v[1];
}

