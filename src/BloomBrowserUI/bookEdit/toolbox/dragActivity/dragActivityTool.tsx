/** @jsx jsx **/
import { jsx, css, ThemeProvider } from "@emotion/react";

import * as React from "react";
import ReactDOM = require("react-dom");
import ToolboxToolReactAdaptor from "../toolboxToolReactAdaptor";
import { kDragActivityToolId } from "../toolIds";
//import Tabs from "@mui/material/Tabs";
import { useState } from "react";
import {
    kBloomBlue,
    kUiFontStack,
    toolboxTheme
} from "../../../bloomMaterialUITheme";
import { TriangleCollapse } from "../../../react_components/TriangleCollapse";
import { Div } from "../../../react_components/l10nComponents";
import {
    OverlayImageItem,
    OverlayItemRegion,
    OverlayItemRow,
    OverlayTextItem
} from "../overlay/overlayItem";
import { OverlayTool } from "../overlay/overlayTool";
//import { Tab } from "@mui/material";

const Tabs: React.FunctionComponent<{
    value: number;
    onChange: (newValue: number) => void;
    labels: string[];
    classNane?: string;
}> = props => {
    return (
        <div
            css={css`
                display: flex;
                background-color: white;
                // minimze the x padding since space-around gives extra if we have room; but as these
                // labels get translated, we may need more space for them.
                padding: 7px 2px;
                justify-content: space-around;
            `}
            className={props.classNane}
        >
            {props.labels.map((child, index) => {
                const selected = index === props.value;
                return (
                    <button
                        key={child}
                        onClick={() => props.onChange(index)}
                        css={css`
                            font-family: ${kUiFontStack};
                            color: ${selected ? "white" : kBloomBlue};
                            background-color: ${selected
                                ? kBloomBlue
                                : "white"};
                            border: none;
                            padding: 2px;
                            border-radius: 3px;
                        `}
                    >
                        {child}
                    </button>
                );
            })}
        </div>
    );
};

export const setupDraggingTargets = (startingPoint: HTMLElement) => {
    const page = startingPoint.closest(".bloom-page") as HTMLElement;
    page.querySelectorAll("[data-target-of]").forEach((elt: HTMLElement) => {
        // const correctPosition = elt.getAttribute(
        //     "data-correct-position"
        // );
        // if (!correctPosition) {
        //     return;
        // }
        // const parts = correctPosition.split(",");
        // if (parts.length !== 2) {
        //     return;
        // }
        // const x = parseInt(parts[0], 10);
        // const y = parseInt(parts[1], 10);
        // this.slots.push({ x, y });

        elt.addEventListener("mousedown", startDrag);
    });
};

let dragStartX = 0;
let dragStartY = 0;
let dragTarget: HTMLElement;
let snapped = false;

const startDrag = (e: MouseEvent) => {
    // get the mouse cursor position at startup:
    const target = e.currentTarget as HTMLElement;
    dragTarget = target;
    const page = target.closest(".bloom-page") as HTMLElement;
    // scaled / unscaled
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    // if (!dragTarget.getAttribute("data-originalLeft")) {
    //     dragTarget.setAttribute(
    //         "data-originalLeft",
    //         target.style.left
    //     );
    //     dragTarget.setAttribute("data-originalTop", target.style.top);
    // }
    dragStartX = e.clientX / scale - target.offsetLeft;
    dragStartY = e.clientY / scale - target.offsetTop;
    page.addEventListener("mouseup", stopDrag);
    // call a function whenever the cursor moves:
    page.addEventListener("mousemove", elementDrag);
};
const elementDrag = (e: MouseEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    e.preventDefault();
    let x = e.clientX / scale - dragStartX;
    let y = e.clientY / scale - dragStartY;
    //let deltaMin = Number.MAX_VALUE;
    // snapped = false;
    // for (const slot of slots) {
    //     let deltaX = slot.x - x;
    //     let deltaY = slot.y - y;
    //     let delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    //     if (delta < deltaMin) {
    //         deltaMin = delta;
    //         if (delta < 50) {
    //             // review: how close do we want?
    //             x = slot.x;
    //             y = slot.y;
    //             snapped = true;
    //         }
    //     }
    // }
    dragTarget.style.top = y + "px";
    dragTarget.style.left = x + "px";
};
const stopDrag = (e: MouseEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    // if (!this.snapped) {
    //     this.dragTarget.style.top = this.dragTarget.getAttribute(
    //         "data-originalTop"
    //     )!;
    //     this.dragTarget.style.left = this.dragTarget.getAttribute(
    //         "data-originalLeft"
    //     )!;
    // }
    page.removeEventListener("mouseup", stopDrag);
    page.removeEventListener("mousemove", elementDrag);
};

const Instructions: React.FunctionComponent<{
    l10nKey: string;
    l10nTitleKey?: string;
}> = props => {
    return (
        <TriangleCollapse
            initiallyOpen={true}
            labelL10nKey={
                props.l10nTitleKey ??
                "EditTab.Toolbox.DragActivity.Instructions"
            }
            indented={true}
        >
            <Div
                l10nKey={"EditTab.Toolbox.DragActivity." + props.l10nKey}
            ></Div>
        </TriangleCollapse>
    );
};

const DragActivityControls: React.FunctionComponent = () => {
    const [activeTab, setActiveTab] = useState(0);
    const handleChange = (newValue: number) => {
        setActiveTab(newValue);
    };
    const [dragObjectType, setDragObjectType] = useState("text");
    // Todo: something has to call setDragObjectType when a draggable is selected.
    let titleId = "EditTab.Toolbox.DragActivity.Draggable";
    let bodyId = "EditTab.Toolbox.DragActivity.DraggableInstructions";
    if (dragObjectType === "dragTarget") {
        titleId = "EditTab.Toolbox.DragActivity.DraggableTarget";
        bodyId = "EditTab.Toolbox.DragActivity.DraggableTargetInstructions";
    } else if (dragObjectType === "orderCircle") {
        titleId = "EditTab.Toolbox.DragActivity.OrderCircle";
        bodyId = "EditTab.Toolbox.DragActivity.OrderCircleInstructions";
    }

    return (
        <ThemeProvider theme={toolboxTheme}>
            <Tabs
                value={activeTab}
                onChange={handleChange}
                labels={["Scene", "Object", "Correct", "Wrong", "Test"]}
            />
            {activeTab === 0 && (
                <div>
                    <Div l10nKey="SceneInstructions" />
                    <OverlayItemRegion>
                        <OverlayItemRow>
                            <OverlayTextItem
                                // todo: we want something smaller with an eng.
                                // todo: we want labels
                                css={css`
                                    margin-left: 5px;
                                    text-align: center; // Center the text horizontally

                                    padding-top: 1em;
                                    vertical-align: middle;
                                    padding-bottom: 1em;

                                    color: white;
                                    border: 1px dotted white;
                                `}
                                l10nKey="EditTab.Toolbox.ComicTool.TextBlock"
                                style="none"
                                draggable={true}
                            />
                            <OverlayImageItem
                                src="/bloom/bookEdit/toolbox/overlay/image-overlay.svg"
                                style="image"
                                draggable={true}
                                // Todo: we want an 'other' button
                            />
                        </OverlayItemRow>
                        {/* We want an item type control,a draggable checkbox, a sound-when-pressed control */}
                    </OverlayItemRegion>
                </div>
            )}
            {activeTab === 1 && (
                <div>
                    <Instructions l10nKey={bodyId} l10nTitleKey={titleId} />
                </div>
            )}
            {activeTab === 2 && (
                <div>
                    <Instructions l10nKey="CorrectInstructions" />
                </div>
            )}
            {activeTab === 3 && (
                <div>
                    <Instructions l10nKey="WrongInstructions" />
                </div>
            )}
            {activeTab === 4 && (
                <div>
                    <Div
                        css={css`
                            margin-top: 5px;
                            margin-left: 5px;
                        `}
                        l10nKey="EditTab.Toolbox.DragActivity.TestInstructions"
                    />
                </div>
            )}
        </ThemeProvider>
    );
};

export class DragActivityTool extends ToolboxToolReactAdaptor {
    public static theOneDragActivityTool: DragActivityTool | undefined;

    public callOnNewPageReady: () => void | undefined;

    public constructor() {
        super();

        DragActivityTool.theOneDragActivityTool = this;
    }

    public makeRootElement(): HTMLDivElement {
        const root = document.createElement("div");
        //root.setAttribute("class", "DragActivityBody");

        ReactDOM.render(<DragActivityControls />, root);
        return root as HTMLDivElement;
    }

    public id(): string {
        return kDragActivityToolId;
    }

    public isExperimental(): boolean {
        return false; // Todo: probably soon true, but first we need to make a control to turn it on
    }

    public toolRequiresEnterprise(): boolean {
        return true;
    }

    public beginRestoreSettings(settings: string): JQueryPromise<void> {
        // Nothing to do, so return an already-resolved promise.
        const result = $.Deferred<void>();
        result.resolve();
        return result;
    }

    public newPageReady() {
        // const bubbleManager = OverlayTool.bubbleManager();
        // if (!bubbleManager) {
        //     // probably the toolbox just finished loading before the page.
        //     // No clean way to fix this
        //     window.setTimeout(() => this.newPageReady(), 100);
        //     return;
        // }
        const page = DragActivityTool.getBloomPage();
        if (!page) {
            // probably the toolbox just finished loading before the page.
            window.setTimeout(() => this.newPageReady(), 100);
            return;
        }
        setupDraggingTargets(page);
    }

    public detachFromPage() {
        // const bubbleManager = OverlayTool.bubbleManager();
        // if (bubbleManager) {
        //     // For now we are leaving bubble editing on, because even with the toolbox hidden,
        //     // the user might edit text, delete bubbles, move handles, etc.
        //     // We turn it off only when about to save the page.
        //     //bubbleManager.turnOffBubbleEditing();
        //     EnableAllImageEditing();
        //     bubbleManager.detachBubbleChangeNotification();
        // }
    }

    // public static bubbleManager(): BubbleManager | undefined {
    //     const exports = getEditablePageBundleExports();
    //     return exports ? exports.getTheOneBubbleManager() : undefined;
    // }
}
