// A very simple Undo manager using MutationObserver.
// Limitations/reservations:
// - Only supports undoing DOM mutations (childList, attributes, characterData).
//   We can't yet handle undoing side effects like creating or deleting a file.
// - Doesn't guarantee that any event handlers or similar state are restored when a deletion is reversed.
// - Doesn't attempt to restore selection or scroll position
// - Doesn't try to distinguish DOM changes that are just UI and ones that are part of the user's persistent data.
// - Only handles changes in the current document, not in other iframes (e.g., our toolbox)
// - stack will not survive anything that causes the document to be reloaded
export class UndoManager {
    private observer: MutationObserver;
    private actionsStack: {
        actionName: string;
        mutations: MutationRecord[];
    }[] = [];
    private currentMutations: MutationRecord[] = [];
    private isRecording: boolean = false;
    private actionName: string = "";
    private redoStack: {
        actionName: string;
        mutations: MutationRecord[];
    }[] = [];

    private static instance: UndoManager | undefined;
    public static theOneUndoManager(): UndoManager {
        if (!UndoManager.instance) {
            UndoManager.instance = new UndoManager();
        }
        return UndoManager.instance;
    }

    private maxUndoStack = 10;

    constructor() {
        this.observer = new MutationObserver(mutations => {
            if (this.isRecording) {
                this.currentMutations.push(...mutations);
                console.log(
                    "recorded " +
                        mutations.length +
                        " mutations for action: " +
                        this.actionName
                );
            } else {
                if (mutations.some(m => m.type === "childList")) {
                    console.log(
                        "Got childList mutations when not recording an action. Ignoring."
                    );
                }
                console.log(
                    "Got mutations when not recording an action. Ignoring."
                );
            }
        });
    }

    public beginAction(actionName: string) {
        // Enhance: report some error if already recording an action?
        console.log("beginAction: " + actionName);
        this.currentMutations = [];
        this.isRecording = true;
        this.actionName = actionName;
        this.observer.observe(document.body, {
            childList: true,
            attributes: true,
            subtree: true,
            characterData: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });
        console.log("Recording action: " + actionName);
    }

    public endAction() {
        this.isRecording = false;
        //this.observer.disconnect();
        if (this.currentMutations.length > 0) {
            console.log(
                "Finished recording action: " +
                    this.actionName +
                    " with " +
                    this.currentMutations.length +
                    " mutations"
            );
            // made a new action, can't redo anything previously undone.
            this.redoStack = [];
            this.actionsStack.push({
                actionName: this.actionName,
                mutations: this.currentMutations
            });
            if (this.actionsStack.length > this.maxUndoStack) {
                this.actionsStack.shift(); // discard the oldest action
            }
        } else {
            console.log("No mutations recorded for action: " + this.actionName);
        }
    }

    public canUndo(): boolean {
        return this.actionsStack.length > 0;
    }

    public undoLabel(): string {
        if (this.actionsStack.length === 0) {
            return "Undo";
        }
        // todo: localize?
        return `Undo ${
            this.actionsStack[this.actionsStack.length - 1].actionName
        }`;
    }

    public undoAction() {
        if (this.actionsStack.length === 0) {
            console.log("No actions to undo");
            return;
        }

        const lastAction = this.actionsStack.pop();
        this.redoStack.push(lastAction!);
        if (lastAction) {
            lastAction.mutations.reverse().forEach(mutation => {
                switch (mutation.type) {
                    case "childList":
                        mutation.addedNodes.forEach(node =>
                            node.parentNode?.removeChild(node)
                        );
                        Array.from(mutation.removedNodes)
                            .reverse()
                            .forEach(node =>
                                mutation.target.insertBefore(
                                    node,
                                    mutation.nextSibling
                                )
                            );
                        break;
                    case "attributes":
                        const targetElement = mutation.target as HTMLElement;
                        if (mutation.oldValue !== null) {
                            const newValue = targetElement.getAttribute(
                                mutation.attributeName!
                            );
                            // save this for possible redo
                            (mutation as any).newValue = newValue;
                            targetElement.setAttribute(
                                mutation.attributeName!,
                                mutation.oldValue
                            );
                        } else {
                            targetElement.removeAttribute(
                                mutation.attributeName!
                            );
                        }
                        break;
                    case "characterData":
                        (mutation as any).newValue = (mutation.target as CharacterData).data;
                        (mutation.target as CharacterData).data = mutation.oldValue!;
                        break;
                }
            });
        }
    }

    public canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public redoLabel(): string {
        if (this.redoStack.length === 0) {
            return "Redo";
        }
        return `Redo ${this.redoStack[this.redoStack.length - 1].actionName}`;
    }

    redoAction() {
        if (this.redoStack.length === 0) {
            console.log("No actions to redo");
            return;
        }

        const lastAction = this.redoStack.pop();
        if (lastAction) {
            this.actionsStack.push(lastAction);
            lastAction.mutations.forEach(mutation => {
                switch (mutation.type) {
                    case "childList":
                        mutation.removedNodes.forEach(node =>
                            node.parentNode?.removeChild(node)
                        );
                        Array.from(mutation.addedNodes)
                            .reverse()
                            .forEach(node =>
                                mutation.target.insertBefore(
                                    node,
                                    mutation.nextSibling
                                )
                            );
                        break;
                    case "attributes":
                        const targetElement = mutation.target as HTMLElement;
                        const newValue = (mutation as any).newValue;
                        if (newValue !== null) {
                            targetElement.setAttribute(
                                mutation.attributeName!,
                                newValue
                            );
                        } else {
                            targetElement.removeAttribute(
                                mutation.attributeName!
                            );
                        }
                        break;
                    case "characterData":
                        (mutation.target as CharacterData).data = (mutation as any).newValue!;
                        break;
                }
            });
        }
    }
}
