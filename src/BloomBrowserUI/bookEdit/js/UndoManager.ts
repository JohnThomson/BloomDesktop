// A very simple Undo manager using Dom snapshots.
// Limitations/reservations:
// - Only supports undoing DOM mutations (childList, attributes, characterData).
//   We can't yet handle undoing side effects like creating or deleting a file.
// - Doesn't guarantee that any event handlers or similar state are restored when a deletion is reversed.
//   code that makes such changes should add a task to the undo stack to restore them.
// - Doesn't attempt to restore selection or scroll position
// - Doesn't try to distinguish DOM changes that are just UI and ones that are part of the user's persistent data.
//   Todo: a mouse handler that knows it has changed the DOM in a way that doesn't need to be undoable
//   should be able to call a new method discardUndoSnapshot() to forget the state at the beginning of this click;
//   a subsequent Undo will therefore go further back, to before the last click that didn't call that method.
//   [But I think the state after the discardUndoSnapshot() should be remembered as the state to compare against
//   for the next makeUndoSnapshot(), otherwise, we'd have to discard again if something trivial happens.]
// - Only handles changes in the current document, not in other iframes (e.g., our toolbox)
// - stack will not survive anything that causes the document to be reloaded
// - Mouse events in the toolbox are not yet handled. Several such changes could get lumped together.
//
// Possible enhancements:
// - Trash can: could add a method trash(element) that removes it from its parent and adds it to a new trash
//   list in the current undoStack entry. When Undo wants to restore an element and doesn't find one with
//   the right ID in the current DOM, it would just look in the trash, and if found, restore it to its parent
//   and recursively restore its content. This would preserve event listeners.

import { ckeditorCanUndo, ckeditorUndo } from "../editablePage";

class UndoNode {}
class UndoElement extends UndoNode {
    tagname: string = "";
    children: UndoNode[] = [];
    props: {}; // object with keys that are attribute names and values that are attribute values
    id: string = "";
}
interface IUndoStackItem {
    actionName: string;
    initialState: UndoElement; // the state of the .bloom-page that Undo should restore
    // other tasks to undo the action, besides restoring initialState.
    // for example, restored deleted elements may need event listeners reattached.
    undoTasks: (() => void)[];
    editor: CKEDITOR.editor | undefined;
}

class UndoTextNode extends UndoNode {
    textContent: string | null;
}
export class UndoManager {
    private undoStack: IUndoStackItem[] = [];

    private static instance: UndoManager | undefined;
    public static theOneUndoManager(): UndoManager {
        if (!UndoManager.instance) {
            UndoManager.instance = new UndoManager();
        }
        return UndoManager.instance;
    }

    private maxUndoStack = 20;

    public makeUndoSnapshot() {
        const start = performance.now();
        const initialState = createUndoElement(
            document.getElementsByClassName("bloom-page")[0] as HTMLElement
        );
        if (this.undoStack.length > 0) {
            // if the last snapshot is the same as the current one, don't add a new one
            const lastStackItem = this.undoStack[this.undoStack.length - 1];
            const lastState = lastStackItem.initialState;
            let currentCkEkditorUndoId =
                CKEDITOR.currentInstance?.element?.getAttribute(
                    "data-undo-id"
                ) ?? "";
            if (CKEDITOR.currentInstance !== lastStackItem.editor) {
                // We will no longer allow ckeditor undoes within that element; rather,
                // all changes to it can be undone as a unit.
                (lastStackItem.editor as any)?.undoManager?.reset();
            }
            if (
                equivalentStates(
                    lastState,
                    initialState,
                    currentCkEkditorUndoId
                )
            ) {
                // I thought originally that we should not make a snapshot if the state is unchanged.
                // But maybe there are changes inside the CkEditor instance that mean this state
                // will be significant, if this mouse event changes something so that CkEditor
                // Undos won't be used.
                console.log(
                    "Snapshot unchanged after " +
                        (performance.now() - start) +
                        "ms"
                );
            } else {
                // A change that extends beyond the content of the current CkEditor instance has been detected.
                // Undo should undo that change, not any changes within the CkEditor instance.
                (CKEDITOR.currentInstance as any)?.undoManager?.reset();
            }
        }
        this.undoStack.push({
            actionName: "undo",
            initialState,
            undoTasks: [],
            editor: CKEDITOR.currentInstance
        });
        if (this.undoStack.length > this.maxUndoStack) {
            this.undoStack.shift();
        }
        console.log("Snapshot took " + (performance.now() - start) + "ms");
    }

    public canUndo(): boolean {
        if (this.undoStack.length === 0) {
            // Before the first mouse click! But just conceivably something has focus
            // and CkEditor has an undo it can do.
            return ckeditorCanUndo();
        }
        const lastStackItem = this.undoStack[this.undoStack.length - 1];
        let currentCkEkditorUndoId =
            CKEDITOR.currentInstance?.element?.getAttribute("data-undo-id") ??
            "";
        if (CKEDITOR.currentInstance !== lastStackItem.editor) {
            // We will no longer allow ckeditor undoes within that element; rather,
            // all changes to it can be undone as a unit.
            (lastStackItem.editor as any)?.undoManager?.reset();
        }
        const currentState = createUndoElement(
            document.getElementsByClassName("bloom-page")[0] as HTMLElement
        );
        if (
            !equivalentStates(
                currentState,
                lastStackItem.initialState,
                currentCkEkditorUndoId
            )
        ) {
            // The current top state is different outside the current CkEditor element.
            // We will undo to that state.
            return true;
        }
        // returning to the TOS state would not be a meaningful undo (except perhaps for undoing one or more
        // CkEditor-level Undos). In this state CkEditor Undos are allowed.
        if (ckeditorCanUndo()) {
            return true;
        }
        // the top state is not significantly different, and there are no CkEditor undos to do.
        // Can we find some state that IS different? Note that from here on, we WILL consider differences
        // inside the current CkEditor instance.
        for (let i = this.undoStack.length - 2; i >= 0; i--) {
            if (
                !equivalentStates(
                    currentState,
                    this.undoStack[i].initialState,
                    ""
                )
            ) {
                return true;
            }
        }
        return false;
    }

    public undo() {
        if (this.undoStack.length === 0) {
            // Before the first mouse click! But just conceivably something has focus
            // and CkEditor has an undo it can do.
            if (ckeditorCanUndo()) {
                ckeditorUndo();
                return;
            }
            console.log("Attempted undo, but no actions to undo");
            return;
        }
        let lastStackItem = this.undoStack[this.undoStack.length - 1];
        let currentCkEkditorUndoId =
            CKEDITOR.currentInstance?.element?.getAttribute("data-undo-id") ??
            "";
        if (CKEDITOR.currentInstance !== lastStackItem.editor) {
            // We will no longer allow ckeditor undoes within that element; rather,
            // all changes to it can be undone as a unit.
            (lastStackItem.editor as any)?.undoManager?.reset();
            currentCkEkditorUndoId = ""; // don't exempt changes within the current CkEditor instance
        }
        const currentState = createUndoElement(
            document.getElementsByClassName("bloom-page")[0] as HTMLElement
        );
        let firstTime = true;
        while (
            equivalentStates(
                currentState,
                lastStackItem.initialState,
                currentCkEkditorUndoId
            )
        ) {
            // nothing has changed, except possibly in CkEditor, so we may consider a CkEditor Undo
            if (firstTime && ckeditorCanUndo()) {
                ckeditorUndo();
                return;
            }
            firstTime = false;
            // Things are effectively unchanged from the current TOS, so we need to go back further.
            // (This means we will lose any undoTasks in the current TOS. The assumption is that any
            // mouse event that needs undoTasks will make a change to the DOM.)
            this.undoStack.pop();
            lastStackItem = this.undoStack[this.undoStack.length - 1];
            currentCkEkditorUndoId = ""; // From now on, changes inside this element count.
        }

        if (this.undoStack.length === 0) {
            console.log(
                "Attempted undo, but all saved states are eqivalent to the current state"
            );
            return;
        }

        // We get here if
        // - Comparing with the TOS state shows a meaningful change outside the CkEditor element
        // - The original TOS state was the same, so we looked for a CkEditor Undo, but didn't find one.
        //   We popped that state of the stack until we found a meaningful undo.
        // So now we want to restore the TOS state. Also, we should forget any ckEditor undos, since we
        // are about to go further back than they would take us. (May have already done that.)
        (CKEDITOR.currentInstance as any)?.undoManager?.reset();
        const lastState = this.undoStack.pop();
        //this.redoStack.push(lastState!);
        if (lastState?.initialState) {
            const page = document.getElementsByClassName("bloom-page")[0];
            applyUndoElement(
                page as HTMLElement,
                lastState.initialState as UndoElement
            );
            // We need to do this after we change the DOM, because we may need to
            // reattach event handlers to the restored elements.
            lastState.undoTasks.forEach(task => task());
        }
    }

    public addUndoTask(task: () => void) {
        // We give priority to CkEditor Undo actions. We reset CkEditor undo stacks when we detect a change
        // at a higher level.
        const ckEditorManager = (CKEDITOR.currentInstance as any)?.undoManager;
        if (ckEditorManager?.undoable()) {
            ckEditorManager.reset();
            return;
        }
        if (this.undoStack.length === 0) {
            console.error("addUndoTask called with no snapshot to attach to");
            return;
        }
        this.undoStack[this.undoStack.length - 1].undoTasks.push(task);
    }
}

export function createUndoElement(domElement: HTMLElement): UndoElement {
    const traverse = (node: Node): UndoNode | undefined => {
        if (node.nodeType === Node.TEXT_NODE) {
            const resultNode = new UndoTextNode();
            resultNode.textContent = node.textContent;
            return resultNode;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return undefined;
        }

        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        const props = {};

        Array.from(element.attributes)
            // we don't want data-undo-id in the props, because adding one is not a change that can be undone,
            // so it should not cause two successive snapshots to be considered different.
            // Which element is active is not an undoable change.
            // Title is just for UI, so we don't need to Undo it.
            .filter(
                e =>
                    e.name !== "data-undo-id" &&
                    e.name !== "data-bloom-active" &&
                    e.name !== "title"
            )
            .forEach(attr => {
                props[attr.name] = attr.value;
            });
        let undoId = element.getAttribute("data-undo-id");
        if (!undoId) {
            undoId = Math.random().toString();
            element.setAttribute("data-undo-id", undoId);
        }

        const children = Array.from(element.childNodes)
            .map(traverse)
            .filter(x => x); // remove undefineds

        const resultElement = new UndoElement();
        resultElement.tagname = tagName;
        resultElement.children = children as UndoNode[];
        resultElement.props = props;
        resultElement.id = undoId;

        return resultElement;
    };

    return traverse(domElement) as UndoElement;
}

export function applyUndoElement(element: HTMLElement, state: UndoElement) {
    const traverse = (node: Node, undoNode: UndoNode) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const undoTextNode = undoNode as UndoTextNode;
            textNode.textContent = undoTextNode.textContent;
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const element = node as HTMLElement;
        const undoElement = undoNode as UndoElement;
        if (element.tagName.toLowerCase() !== undoElement.tagname) {
            console.error(
                "Mismatched tags",
                element.tagName,
                undoElement.tagname
            );
            return;
        }

        // restore the attributes
        for (const [key, value] of Object.entries(undoElement.props)) {
            element.setAttribute(key, value as string);
        }
        // remove any attributes that were added since the snapshot.
        // Never remove data-undo-id, as that is used to identify elements, and may
        // be needed for undoing a previous snapshot.
        const currentAttributes = Array.from(element.attributes)
            .map(a => a.name)
            .filter(a => a !== "data-undo-id");

        for (const key of currentAttributes) {
            if (!undoElement.props[key]) {
                element.removeAttribute(key);
            }
        }

        const undoChildren = undoElement.children;
        const unmatchedChidren = Array.from(element.childNodes);
        for (let i = 0; i < undoChildren.length; ) {
            if (unmatchedChidren.length > 0) {
                const nextUndoChild = undoChildren[i];
                const nextChild = unmatchedChidren[0];
                if (nextChild.nodeType === Node.TEXT_NODE) {
                    if (nextUndoChild instanceof UndoTextNode) {
                        // make the DOM match the snapshot; advance in both arrays
                        traverse(nextChild, undoChildren[i]);
                        unmatchedChidren.shift();
                        i++;
                    }
                    // next thing in the input is some text we don't want. Remove and try again.
                    else {
                        element.removeChild(nextChild);
                        unmatchedChidren.shift();
                    }
                } else if (nextChild.nodeType === Node.ELEMENT_NODE) {
                    if (nextUndoChild instanceof UndoElement) {
                        if (
                            (nextChild as HTMLElement).getAttribute(
                                "data-undo-id"
                            ) === nextUndoChild.id
                        ) {
                            // The next child in the state we are restoring is the corresponding element. Recurse
                            // and advance in both lists.
                            traverse(nextChild, nextUndoChild);
                            unmatchedChidren.shift();
                            i++;
                        } else {
                            // The next child in the state we are restoring is some other element. This might mean that
                            // nextChild was an addition that we need to remove. On the other hand, perhaps nextUndoChild
                            // represents a deletion that we need to restore.
                            const nextChildId = (nextChild as HTMLElement).getAttribute(
                                "data-undo-id"
                            );
                            if (!nextChildId) {
                                // wasn't there at all in the snapshot. Remove it.
                                element.removeChild(nextChild);
                                unmatchedChidren.shift();
                            } else if (
                                !unmatchedChidren.some(
                                    c =>
                                        c instanceof HTMLElement &&
                                        c.getAttribute("data-undo-id") ===
                                            nextUndoChild.id
                                )
                            ) {
                                // The next child in the state we are restoring is a deletion; there is no corresponding item
                                // in the current state of things. Restore a clone. Advance through the undoChildren, but not the
                                // unmatchedChildren, because we haven't found a match for the first thing in that.
                                element.insertBefore(
                                    createNode(nextUndoChild),
                                    nextChild
                                );
                                i++;
                            } else {
                                // It's possible that things have been re-ordered. We might find nextChildId later in undoChildren.
                                // May decide to handle that, by pushing nextChild back onto the end of unmatchedChildren, or into a new list,
                                // if its ID occurs in undoChildren later. For now, I think handling simple deletions and insertions is enough.
                                // So we'll just drop it. If the ID occurs again, it will have to be re-created. Advance through
                                // unmatchedChidren, but not undoChildren.
                                element.removeChild(nextChild);
                                unmatchedChidren.shift();
                            }
                        }
                    } else {
                        // The next child in the state we are restoring is some text. Insert it and advance past it.
                        element.insertBefore(
                            createNode(nextUndoChild),
                            nextChild
                        );
                        i++;
                    }
                } else {
                    console.error("Unexpected node type");
                    unmatchedChidren.shift(); // get rid of it and carry on
                }
            } else {
                // no more chldren in the DOM, but there are more in the snapshot. Add them.
                element.appendChild(createNode(undoChildren[i]));
                i++;
            }
        }
        // remove any remaining children in the DOM that don't correspond to anything in the snapshot
        unmatchedChidren.forEach(child => {
            element.removeChild(child);
        });
    };
    traverse(element, state);
}
function createNode(input: UndoNode): Node {
    if (input instanceof UndoElement) {
        const element = document.createElement(input.tagname);
        for (const [key, value] of Object.entries(input.props)) {
            element.setAttribute(key, value as string);
        }
        // Setting this allows client code (e.g., one of the tasks added with addUndoTask)
        // to find the replacement element (e.g., to add event listeners to it).
        element.setAttribute("data-undo-id", input.id);
        input.children.forEach(child => {
            element.appendChild(createNode(child));
        });
        return element;
    } else if (input instanceof UndoTextNode) {
        return document.createTextNode(input.textContent as string);
    }
    return document.createTextNode("something went wrong here");
}

export function equivalentStates(
    aNode: UndoNode,
    bNode: UndoNode,
    ignoreInnerId: string
): boolean {
    if (aNode instanceof UndoTextNode) {
        return (
            bNode instanceof UndoTextNode &&
            aNode.textContent === bNode.textContent
        );
    } else if (bNode instanceof UndoTextNode) {
        return false;
    }
    const a = aNode as UndoElement;
    const b = bNode as UndoElement;
    if (a.tagname !== b.tagname) {
        return false;
    }
    if (a.id !== b.id) {
        return false;
    }
    // Tempting, but it won't ignore missing vs empty
    // if (JSON.stringify(a.props) !== JSON.stringify(b.props)) {
    //     return false;
    // }
    for (const [key, value] of Object.entries(a.props)) {
        const match = b.props[key];
        // They must be the same, or both must be some version of empty.
        if (match !== value && (match || value)) {
            return false;
        }
    }
    for (const [key, value] of Object.entries(b.props)) {
        const match = a.props[key];
        // I think this could be simplified, since we already checked it if a has the property at all.
        // But it's easier to see that this is right, and I don't think the optimization would buy us much.
        if (match !== value && (match || value)) {
            return false;
        }
    }
    if (a.id === ignoreInnerId) {
        // We already checked the IDs and attributes are the same, we don't care about anything inside.
        return true;
    }
    const importantFilter = (x: UndoNode) => {
        if (x instanceof UndoElement) {
            const className = x.props["class"];
            if (
                className &&
                className.split(" ").some(c => c.startsWith("bloom-ui"))
            ) {
                return false;
            }
        }
        return true;
    };
    const aChildren = a.children.filter(importantFilter);
    const bChildren = b.children.filter(importantFilter);
    if (aChildren.length !== bChildren.length) {
        return false;
    }
    for (let i = 0; i < aChildren.length; i++) {
        if (!equivalentStates(aChildren[i], bChildren[i], ignoreInnerId)) {
            return false;
        }
    }
    return true;
}

// Todo:
// - possibly add more complex test cases involving changes to nested elements
// - further testing of CkEditor integration. At the moment it seems to be working better than I intended,
//   in that we can sometimes get CkEditor undos not just in the most recently focused text box.
//   That might be nice, but since it wasn't intended it is worrying.
// - Handle mousedown in toolbox
// - Handle any relevant keyboard events
// - Handle any further cases where undoing a deletion requires restoring event handlers
// - Handle at least obvious cases where a click changes the DOM but the change shouldn't be undoable
//   (for example, changing the selected overlay without moving or modifying it).
// - Do something about talking book recording, and possibly video recording. This overwrites the
//   old file, so we need to improve something for undo to work right. At least clear the Undo stack
//   so it's obvious we can't undo yet.
// - Ask testers to try to break it.
