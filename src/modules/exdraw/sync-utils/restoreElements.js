/* eslint-disable no-case-declarations */
import { DEFAULT_ELEMENT_PROPS, DEFAULT_FONT_FAMILY, DEFAULT_TEXT_ALIGN, DEFAULT_VERTICAL_ALIGN, FONT_FAMILY, ROUNDNESS } from "./common/contants";
import { getLineHeight } from "./common/font-metadata";
import { randomId } from "./common/random";
import { normalizeLink } from "./common/url";
import { arrayToMap, getUpdatedTimestamp } from "./common/utils";
import { normalizeFixedPoint } from "./element/binding";
import { syncInvalidIndices } from "./element/functionIndex";
import LinearElementEditor from "./element/LinearElementEditor";
import { bumpVersion } from "./element/mutateElement";
import { getNormalizedDimensions, isInvisiblySmallElement } from "./element/sizeHelper";
import { detectLineHeight } from "./element/textMeasurements";
import { isElbowArrow, isFixedPointBinding, isLineElement, isUsingAdaptiveRadius, isValidPolygon } from "./element/typeChecks";
import { getSizeFromPoints, pointFrom } from "./math/points";

const getFontFamilyByName = fontFamilyName => {
  if (Object.keys(FONT_FAMILY).includes(fontFamilyName)) {
    return FONT_FAMILY[fontFamilyName];
  }
  return DEFAULT_FONT_FAMILY;
};

const restoreElementWithProperties = (element, extra) => {
  const base = {
    type: extra.type || element.type,
    // all elements must have version > 0 so getSceneVersion() will pick up
    // newly added elements
    version: element.version || 1,
    versionNonce: element.versionNonce ?? 0,
    index: element.index ?? null,
    isDeleted: element.isDeleted ?? false,
    id: element.id || randomId(),
    fillStyle: element.fillStyle || DEFAULT_ELEMENT_PROPS.fillStyle,
    strokeWidth: element.strokeWidth || DEFAULT_ELEMENT_PROPS.strokeWidth,
    strokeStyle: element.strokeStyle ?? DEFAULT_ELEMENT_PROPS.strokeStyle,
    roughness: element.roughness ?? DEFAULT_ELEMENT_PROPS.roughness,
    opacity:
      element.opacity == null ? DEFAULT_ELEMENT_PROPS.opacity : element.opacity,
    angle: element.angle || 0,
    x: extra.x ?? element.x ?? 0,
    y: extra.y ?? element.y ?? 0,
    strokeColor: element.strokeColor || DEFAULT_ELEMENT_PROPS.strokeColor,
    backgroundColor:
      element.backgroundColor || DEFAULT_ELEMENT_PROPS.backgroundColor,
    width: element.width || 0,
    height: element.height || 0,
    seed: element.seed ?? 1,
    groupIds: element.groupIds ?? [],
    frameId: element.frameId ?? null,
    roundness: element.roundness
      ? element.roundness
      : element.strokeSharpness === "round"
      ? {
          // for old elements that would now use adaptive radius algo,
          // use legacy algo instead
          type: isUsingAdaptiveRadius(element.type)
            ? ROUNDNESS.LEGACY
            : ROUNDNESS.PROPORTIONAL_RADIUS
        }
      : null,
    boundElements: element.boundElementIds
      ? element.boundElementIds.map(id => ({ type: "arrow", id }))
      : element.boundElements ?? [],
    updated: element.updated ?? getUpdatedTimestamp(),
    link: element.link ? normalizeLink(element.link) : null,
    locked: element.locked ?? false
  };

  if ("customData" in element || "customData" in extra) {
    base.customData =
      "customData" in extra ? extra.customData : element.customData;
  }

  const ret = {
    // spread the original element properties to not lose unknown ones
    // for forward-compatibility
    ...element,

    // normalized properties
    ...base,

    ...getNormalizedDimensions(base),
    ...extra
  };

  // strip legacy props (migrated in previous steps)
  delete ret.strokeSharpness;
  delete ret.boundElementIds;

  return ret;
};

const repairBinding = (element, binding) => {
  if (!binding) {
    return null;
  }

  const focus = binding.focus || 0;

  if (isElbowArrow(element)) {
    const fixedPointBinding = isFixedPointBinding(binding)
      ? {
          ...binding,
          focus,
          fixedPoint: normalizeFixedPoint(binding.fixedPoint ?? [0, 0])
        }
      : null;

    return fixedPointBinding;
  }

  return {
    ...binding,
    focus
  };
};


const restoreElement = element => {
  element = { ...element };

  switch (element.type) {
    case "text":
      // temp fix: cleanup legacy obsidian-excalidraw attribute else it'll
      // conflict when porting between the apps
      delete element.rawText;

      let fontSize = element.fontSize;
      let fontFamily = element.fontFamily;
      if ("font" in element) {
        const [fontPx, _fontFamily] = element.font.split(" ");
        fontSize = parseFloat(fontPx);
        fontFamily = getFontFamilyByName(_fontFamily);
      }
      const text = (typeof element.text === "string" && element.text) || "";

      // line-height might not be specified either when creating elements
      // programmatically, or when importing old diagrams.
      // For the latter we want to detect the original line height which
      // will likely differ from our per-font fixed line height we now use,
      // to maintain backward compatibility.
      const lineHeight =
        element.lineHeight ||
        (element.height
          ? // detect line-height from current element height and font-size
            detectLineHeight(element)
          : // no element height likely means programmatic use, so default
            // to a fixed line height
            getLineHeight(element.fontFamily));
      element = restoreElementWithProperties(element, {
        fontSize,
        fontFamily,
        text,
        textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
        verticalAlign: element.verticalAlign || DEFAULT_VERTICAL_ALIGN,
        containerId: element.containerId ?? null,
        originalText: element.originalText || text,
        autoResize: element.autoResize ?? true,
        lineHeight
      });

      // if empty text, mark as deleted. We keep in array
      // for data integrity purposes (collab etc.)
      if (!text && !element.isDeleted) {
        element = { ...element, originalText: text, isDeleted: true };
        element = bumpVersion(element);
      }

      return element;
    case "freedraw": {
      return restoreElementWithProperties(element, {
        points: element.points,
        lastCommittedPoint: null,
        simulatePressure: element.simulatePressure,
        pressures: element.pressures
      });
    }
    case "image":
      return restoreElementWithProperties(element, {
        status: element.status || "pending",
        fileId: element.fileId,
        scale: element.scale || [1, 1],
        crop: element.crop ?? null
      });
    case "line":
    // @ts-ignore LEGACY type
    // eslint-disable-next-line no-fallthrough
    case "draw":
      const { startArrowhead = null, endArrowhead = null } = element;
      let x = element.x;
      let y = element.y;
      let points = // migrate old arrow model to new one
        !Array.isArray(element.points) || element.points.length < 2
          ? [pointFrom(0, 0), pointFrom(element.width, element.height)]
          : element.points;

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({
          points,
          x,
          y
        } = LinearElementEditor.getNormalizeElementPointsAndCoords(element));
      }

      return restoreElementWithProperties(element, {
        type: element.type === "draw" ? "line" : element.type,
        startBinding: repairBinding(element, element.startBinding),
        endBinding: repairBinding(element, element.endBinding),
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
        ...(isLineElement(element)
          ? {
              polygon: isValidPolygon(element.points)
                ? element.polygon ?? false
                : false
            }
          : {}),
        ...getSizeFromPoints(points)
      });
    case "arrow": {
      const { startArrowhead = null, endArrowhead = "arrow" } = element;
      let x = element.x;
      let y = element.y;
      let points = // migrate old arrow model to new one
        !Array.isArray(element.points) || element.points.length < 2
          ? [pointFrom(0, 0), pointFrom(element.width, element.height)]
          : element.points;

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({
          points,
          x,
          y
        } = LinearElementEditor.getNormalizeElementPointsAndCoords(element));
      }

      const base = {
        type: element.type,
        startBinding: repairBinding(element, element.startBinding),
        endBinding: repairBinding(element, element.endBinding),
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
        elbowed: element.elbowed,
        ...getSizeFromPoints(points)
      };

      // TODO: Separate arrow from linear element
      return isElbowArrow(element)
        ? restoreElementWithProperties(element, {
            ...base,
            elbowed: true,
            startBinding: repairBinding(element, element.startBinding),
            endBinding: repairBinding(element, element.endBinding),
            fixedSegments: element.fixedSegments,
            startIsSpecial: element.startIsSpecial,
            endIsSpecial: element.endIsSpecial
          })
        : restoreElementWithProperties(element, base);
    }

    // generic elements
    case "ellipse":
    case "rectangle":
    case "diamond":
    case "iframe":
    case "embeddable":
      return restoreElementWithProperties(element, {});
    case "magicframe":
    case "frame":
      return restoreElementWithProperties(element, {
        name: element.name ?? null
      });

    // Don't use default case so as to catch a missing an element type case.
    // We also don't want to throw, but instead return void so we filter
    // out these unsupported elements from the restored array.
  }
  return null;
};


export const restoreElements = (
  elements,
  /** NOTE doesn't serve for reconciliation */
  localElements,
  opts
) => {
  // used to detect duplicate top-level element ids
  const existingIds = new Set();
  const localElementsMap = localElements ? arrayToMap(localElements) : null;
  const restoredElements = syncInvalidIndices(
    (elements || []).reduce((elements, element) => {
      // filtering out selection, which is legacy, no longer kept in elements,
      // and causing issues if retained
      if (element.type !== "selection" && !isInvisiblySmallElement(element)) {
        let migratedElement = restoreElement(element);
        if (migratedElement) {
          const localElement = localElementsMap?.get(element.id);
          if (localElement && localElement.version > migratedElement.version) {
            migratedElement = bumpVersion(migratedElement, localElement.version);
          }
          if (existingIds.has(migratedElement.id)) {
            migratedElement = { ...migratedElement, id: randomId() };
          }
          existingIds.add(migratedElement.id);

          elements.push(migratedElement);
        }
      }
      return elements;
    }, [])
  );

  if (!opts?.repairBindings) {
    return restoredElements;
  }
};
