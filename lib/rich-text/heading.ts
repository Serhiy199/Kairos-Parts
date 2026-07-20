import type { Editor } from '@tiptap/react';

type HeadingLevel = 2 | 3;

export function applyHeading(editor: Editor, level: HeadingLevel) {
  const { from, to, empty, $from, $to } = editor.state.selection;
  const isPartialSingleBlockSelection =
    !empty &&
    $from.sameParent($to) &&
    $from.parent.isTextblock &&
    ($from.parentOffset > 0 || $to.parentOffset < $from.parent.content.size);

  if (!isPartialSingleBlockSelection) {
    return editor.chain().focus().toggleHeading({ level }).run();
  }

  const parent = $from.parent;
  const paragraphType = editor.schema.nodes.paragraph;
  const headingType = editor.schema.nodes.heading;

  if (!paragraphType || !headingType || from >= to) {
    return false;
  }

  const beforeContent = parent.content.cut(0, $from.parentOffset);
  const selectedContent = parent.content.cut($from.parentOffset, $to.parentOffset);
  const afterContent = parent.content.cut($to.parentOffset);
  const beforeNode = beforeContent.size > 0 ? paragraphType.create(null, beforeContent) : null;
  const heading = headingType.create({ level }, selectedContent);
  const afterNode = afterContent.size > 0 ? paragraphType.create(null, afterContent) : null;
  const replacement = [beforeNode, heading, afterNode].filter((node): node is typeof heading => node !== null);

  const parentStart = $from.before();
  const headingStart = parentStart + (beforeNode?.nodeSize ?? 0);
  const selection = {
    from: headingStart + 1,
    to: headingStart + 1 + selectedContent.size
  };

  const applied = editor.commands.command(({ tr, dispatch }) => {
    if (dispatch) {
      dispatch(tr.replaceWith(parentStart, $from.after(), replacement).scrollIntoView());
    }

    return true;
  });

  if (applied) {
    editor.commands.setTextSelection(selection);
    editor.commands.focus();
  }

  return applied;
}
