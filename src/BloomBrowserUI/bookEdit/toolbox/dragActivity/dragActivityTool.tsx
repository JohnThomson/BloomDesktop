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

export const makeArrow = (start: HTMLElement, end: HTMLElement | undefined) => {
    let arrow = (start.ownerDocument.getElementById(
        "target-arrow"
    ) as unknown) as SVGSVGElement;
    if (!end) {
        if (arrow) {
            arrow.remove();
        }
        return;
    }
    //const scale = page.getBoundingClientRect().width / page.offsetWidth;
    // These values make a line from the center of the start to the center of the end.
    const startX = start.offsetLeft + start.offsetWidth / 2;
    const startY = start.offsetTop + start.offsetHeight / 2;
    const endXCenter = end.offsetLeft + end.offsetWidth / 2;
    const endYCenter = end.offsetTop + end.offsetHeight / 2;
    let endX = endXCenter;
    let endY = endYCenter;
    if (end.offsetLeft > startX) {
        endX = end.offsetLeft;
    } else if (end.offsetLeft + end.offsetWidth < startX) {
        endX = end.offsetLeft + end.offsetWidth;
    }
    if (end.offsetTop > startY) {
        endY = end.offsetTop;
    } else if (end.offsetTop + end.offsetHeight < startY) {
        endY = end.offsetTop + end.offsetHeight;
    }

    if (endX === endXCenter && endY === endYCenter) {
        // The boxes are overlapping. Can't draw an arrow between them.
        if (arrow) {
            arrow.remove();
        }
        return;
    }
    if (!arrow) {
        arrow = start.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );
        arrow.setAttribute("id", "target-arrow");
        start.parentElement!.appendChild(arrow);
    }

    // But we actually want border to border
    // If the line runs through the top or bottom border:
    const yMultiplier = startY < endY ? 1 : -1;
    const deltaYTB = (start.offsetHeight / 2) * yMultiplier;
    const startYTB = startY + deltaYTB;
    // If it's a horizontal arrow, we won't be using this, but we need to avoid dividing by zero and get a really big number
    const deltaXTB =
        endY === startY
            ? 10000000
            : ((startYTB - startY) * (endX - startX)) / (endY - startY);
    const startXTB = startX + deltaXTB;

    // If the line runs through the left or right border:
    const xMultiplier = startX < endX ? 1 : -1;
    const deltaXLR = (start.offsetWidth / 2) * xMultiplier;
    const startXLR = startX + deltaXLR;
    // If it's a vertical arrow, we won't be using this, but we need to avoid dividing by zero and get a really big number
    const deltaYLR =
        endX === startX
            ? 10000000
            : ((startXLR - startX) * (endY - startY)) / (endX - startX);
    const startYLR = startY + deltaYLR;

    // We need to use the point that is closest to the center. (The real delta would require sqrt, but we don't need it.)
    const deltaTB = deltaXTB * deltaXTB + deltaYTB * deltaYTB;
    const deltaLR = deltaXLR * deltaXLR + deltaYLR * deltaYLR;

    // The point where we actually want the starting point of the arrow.
    const finalStartX = deltaTB < deltaLR ? startXTB : startXLR;
    const finalStartY = deltaTB < deltaLR ? startYTB : startYLR;

    // The end point is offset in exactly the opposite way (this works because the boxes are always the same size)
    const finalEndX = endX;
    const finalEndY = endY;

    const deltaX = finalEndX - finalStartX;
    const deltaY = finalEndY - finalStartY;

    let line = arrow.firstChild as SVGLineElement;
    let line2 = line?.nextSibling as SVGLineElement;
    let line3 = line2?.nextSibling as SVGLineElement;
    if (!line) {
        line = start.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );
        arrow.appendChild(line);
        line2 = start.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );
        arrow.appendChild(line2);
        line3 = start.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );
        arrow.appendChild(line3);
    }

    const arrowheadLength = 14;
    const angle =
        deltaY === 0 ? Math.sign(deltaX) * Math.PI : Math.atan(deltaX / deltaY);
    const baseX = 0;
    const baseY = 0;
    const tipX = deltaX;
    const tipY = deltaY;

    const leftAngle = angle + Math.PI / 4;
    const rightAngle = angle - Math.PI / 4;
    const leftArrowX =
        tipX + Math.sin(leftAngle) * -arrowheadLength * Math.sign(deltaY);
    const leftArrowY =
        tipY + Math.cos(leftAngle) * -arrowheadLength * Math.sign(deltaY);
    const rightArrowX =
        tipX + Math.sin(rightAngle) * -arrowheadLength * Math.sign(deltaY);
    const rightArrowY =
        tipY + Math.cos(rightAngle) * -arrowheadLength * Math.sign(deltaY);

    line.setAttribute("x1", baseX.toString());
    line.setAttribute("y1", baseY.toString());
    line.setAttribute("x2", tipX.toString());
    line.setAttribute("y2", tipY.toString());
    line2.setAttribute("x2", tipX.toString());
    line2.setAttribute("y2", tipY.toString());
    line3.setAttribute("x2", tipX.toString());
    line3.setAttribute("y2", tipY.toString());
    line2.setAttribute("x1", leftArrowX.toString());
    line2.setAttribute("y1", leftArrowY.toString());
    line3.setAttribute("x1", rightArrowX.toString());
    line3.setAttribute("y1", rightArrowY.toString());

    // Now figure out how big the arrow is and where to put it.
    const minX = Math.min(baseX, tipX, leftArrowX, rightArrowX);
    const maxX = Math.max(baseX, tipX, leftArrowX, rightArrowX);
    const minY = Math.min(baseY, tipY, leftArrowY, rightArrowY);
    const maxY = Math.max(baseY, tipY, leftArrowY, rightArrowY);
    // Big enough to hold all the points that make up the arrow
    arrow.setAttribute("width", (maxX - minX).toString());
    arrow.setAttribute("height", (maxY - minY).toString());
    // This viewBox avoids the need to translate all the points in the lines
    arrow.setAttribute(
        "viewBox",
        `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
    );
    arrow.style.left = finalStartX + minX + "px";
    arrow.style.top = finalStartY + minY + "px";

    const color = "red";
    const strokeWidth = "3";
    const lines = [line, line2, line3];
    lines.forEach(l => {
        l.setAttribute("stroke", color);
        l.setAttribute("stroke-width", strokeWidth);
    });
    arrow.style.zIndex = "1003";
    arrow.style.position = "absolute";

    //arrow.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    //arrow.setAttribute("viewBox", `0 0 ${deltaX} ${deltaY}`);
};

let dragStartX = 0;
let dragStartY = 0;
let dragTarget: HTMLElement;
//let snapped = false;
let slots: { x: number; y: number }[] = [];

const startDrag = (e: MouseEvent) => {
    // get the mouse cursor position at startup:
    const target = e.currentTarget as HTMLElement;
    dragTarget = target;
    const page = target.closest(".bloom-page") as HTMLElement;
    // scaled / unscaled
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    slots = [];
    page.querySelectorAll("[data-target-of]").forEach((elt: HTMLElement) => {
        const x = elt.offsetLeft;
        const y = elt.offsetTop;
        slots.push({ x, y });
    });
    slots.sort((a, b) => {
        return a.y - b.y;
    });
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
const snapDelta = 50; // review: how close do we want?
const elementDrag = (e: MouseEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    e.preventDefault();
    let x = e.clientX / scale - dragStartX;
    let y = e.clientY / scale - dragStartY;
    let deltaMin = Number.MAX_VALUE;
    let deltaRowMin = Number.MAX_VALUE;
    const width = dragTarget.offsetWidth;
    let snappedToExisting = false;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const deltaX = slot.x - x;
        const deltaY = slot.y - y;
        const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        // It's interesting if it is dropped on top of another target, but only if that target is in a row.
        let inRow = false;
        if (i > 0 && slots[i - 1].y === slot.y) {
            inRow = true;
        }
        if (i < slots.length - 1 && slots[i + 1].y === slot.y) {
            inRow = true;
        }
        if (inRow && delta < deltaMin) {
            deltaMin = delta;
            if (delta < snapDelta) {
                x = slot.x;
                y = slot.y;
                snappedToExisting = true;
            }
        }
        // It's also interesting if it is dropped to the right of another target
        // Todo: possibly also if it is below another one?
        let spacing = width + 15;
        if (inRow) {
            const row = slots.filter(s => s.y === slot.y);
            const lastXInRow = Math.max(...row.map(s => s.x));
            const othersInRow = row.filter(s => s.x < lastXInRow);
            const secondLastXInRow = Math.max(...othersInRow.map(s => s.x));
            spacing = lastXInRow - secondLastXInRow;
        }
        const deltaXRow = slot.x + spacing - x;
        const deltaRow = Math.sqrt(deltaXRow * deltaXRow + deltaY * deltaY);
        if (deltaRow < deltaRowMin && deltaRow < deltaMin) {
            deltaRowMin = deltaRow;
            if (delta < snapDelta) {
                x = slot.x + spacing;
                y = slot.y;
            }
        }
        // Todo: if snappedToExisting, move things around.
        // Todo: something intelligent if we snapped an item that is already in the row to a position beyond the end of the row.
    }
    dragTarget.style.top = y + "px";
    dragTarget.style.left = x + "px";
    const targetId = dragTarget.getAttribute("data-target-of");
    if (targetId) {
        const draggable = page.querySelector(`[data-bubble-id="${targetId}"]`);
        if (draggable) {
            makeArrow(draggable as HTMLElement, dragTarget);
        }
    }
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
                                css={css`
                                    margin-left: 5px;
                                    text-align: center; // Center the text horizontally
                                    padding: 2px 0.5em;
                                    vertical-align: middle;
                                    color: white;
                                    border: 1px dotted white;
                                `}
                                l10nKey="EditTab.Toolbox.DragActivity.Letter"
                                style="none"
                                draggable={true}
                            />
                            <OverlayTextItem
                                css={css`
                                    margin-left: 5px;
                                    text-align: center; // Center the text horizontally
                                    padding: 2px 0.5em;
                                    vertical-align: middle;
                                    color: white;
                                    border: 1px dotted white;
                                `}
                                l10nKey="EditTab.Toolbox.DragActivity.Word"
                                style="none"
                                draggable={true}
                            />{" "}
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
