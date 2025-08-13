class LinearElementEditor {

  static normalizeFixedPoint = fixedPoint => {
    // Do not allow a precise 0.5 for fixed point ratio
    // to avoid jumping arrow heading due to floating point imprecision
    if (
      fixedPoint &&
      (Math.abs(fixedPoint[0] - 0.5) < 0.0001 ||
        Math.abs(fixedPoint[1] - 0.5) < 0.0001)
    ) {
      return fixedPoint.map(ratio =>
        Math.abs(ratio - 0.5) < 0.0001 ? 0.5001 : ratio
      );
    }
    return fixedPoint;
  };

}

export default LinearElementEditor;
