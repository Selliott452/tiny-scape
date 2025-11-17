const TOP_BAR_HEIGHT = 32;
const LEFT_PANEL_RATIO = 0.10;
const RIGHT_PANEL_RATIO = 0.22;
const BOTTOM_LOG_RATIO = 0.20;

export type UiLayout = {
  topBarHeight: number;
  leftWidth: number;
  rightWidth: number;
  worldArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bottomLog: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export function computeUiLayout(totalWidth: number, totalHeight: number): UiLayout {
  const leftWidth = totalWidth * LEFT_PANEL_RATIO;
  const rightWidth = totalWidth * RIGHT_PANEL_RATIO;

  const topBarHeight = TOP_BAR_HEIGHT;
  const usableHeight = totalHeight - topBarHeight;

  const desiredBottomHeight = usableHeight * BOTTOM_LOG_RATIO;
  let worldWidth = totalWidth - leftWidth - rightWidth;
  let worldHeight = usableHeight - desiredBottomHeight;
  const bottomHeight = usableHeight - worldHeight;

  const worldOriginX = leftWidth;
  const worldOriginY = topBarHeight;

  return {
    topBarHeight,
    leftWidth,
    rightWidth,
    worldArea: {
      x: worldOriginX,
      y: worldOriginY,
      width: worldWidth,
      height: worldHeight,
    },
    bottomLog: {
      x: worldOriginX,
      y: topBarHeight + worldHeight,
      width: worldWidth,
      height: bottomHeight,
    },
  };
}

export { TOP_BAR_HEIGHT, LEFT_PANEL_RATIO, RIGHT_PANEL_RATIO, BOTTOM_LOG_RATIO };
