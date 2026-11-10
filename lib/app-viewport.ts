/** Visual viewport shrinkage alone is not evidence of an on-screen keyboard.
 * Pinch zoom must preserve navigation and the underlying layout dimensions. */
export function appViewport(input: {
  layoutWidth: number; layoutHeight: number;
  visualWidth?: number; visualHeight?: number; scale?: number;
  editableFocus: boolean; wasEditing: boolean;
}) {
  const zoomed = Math.abs((input.scale ?? 1) - 1) > 0.05;
  const height = Math.round(zoomed ? input.layoutHeight : (input.visualHeight || input.layoutHeight));
  const width = Math.round(zoomed ? input.layoutWidth : (input.visualWidth || input.layoutWidth));
  const editing = !zoomed && height < input.layoutHeight - 120 &&
    (input.editableFocus || input.wasEditing);
  return { height, width, editing };
}
