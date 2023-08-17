/** @jsx jsx **/
import { jsx, css, ThemeProvider } from "@emotion/react";

import * as React from "react";
import ReactDOM = require("react-dom");
import ToolboxToolReactAdaptor from "../toolboxToolReactAdaptor";
import { kDragActivityToolId } from "../toolIds";
//import Tabs from "@mui/material/Tabs";
import { useEffect, useState } from "react";
import {
    kBloomBlue,
    kUiFontStack,
    toolboxTheme
} from "../../../bloomMaterialUITheme";
import { TriangleCollapse } from "../../../react_components/TriangleCollapse";
import { Div } from "../../../react_components/l10nComponents";
import {
    OverlayButtonItem,
    OverlayImageItem,
    OverlayItemRegion,
    OverlayItemRow,
    OverlayTextItem
} from "../overlay/overlayItem";
import { OverlayTool } from "../overlay/overlayTool";
import { ToolBox } from "../toolbox";
import { prepareActivity } from "./dragActivityRuntime";
import { BubbleManager, theOneBubbleManager } from "../../js/bubbleManager";
import { UpdateImageTooltipVisibility } from "../../js/bloomImages";
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

const overlap = (start: HTMLElement, end: HTMLElement): boolean => {
    return (
        start.offsetLeft + start.offsetWidth > end.offsetLeft &&
        start.offsetLeft < end.offsetLeft + end.offsetWidth &&
        start.offsetTop + start.offsetHeight > end.offsetTop &&
        start.offsetTop < end.offsetTop + end.offsetHeight
    );
};

export const adjustTarget = (
    start: HTMLElement,
    end: HTMLElement | undefined
) => {
    let arrow = (start.ownerDocument.getElementById(
        "target-arrow"
    ) as unknown) as SVGSVGElement;
    if (!end) {
        if (arrow) {
            arrow.remove();
        }
        return;
    }
    let adjustAll = false;
    if (end.offsetHeight !== start.offsetHeight) {
        end.style.height = `${start.offsetHeight}px`;
        adjustAll = true;
    }
    if (end.offsetWidth !== start.offsetWidth) {
        end.style.width = `${start.offsetWidth}px`;
        adjustAll = true;
    }
    if (adjustAll) {
        // We need to adjust the position of all the other targets.
        const page = start.closest(".bloom-page") as HTMLElement;
        const otherDraggables = Array.from(
            page.querySelectorAll("[data-bubble-id]")
        ).filter(x => x !== start);
        const otherTargets = Array.from(
            page.querySelectorAll("[data-target-of]")
        ).filter(x => x !== end);
        otherDraggables.concat(otherTargets).forEach((elt: HTMLElement) => {
            if (elt.offsetHeight !== start.offsetHeight) {
                elt.style.height = `${start.offsetHeight}px`;
            }
            if (elt.offsetWidth !== start.offsetWidth) {
                elt.style.width = `${start.offsetWidth}px`;
            }
        });
    }
    // if start and end overlap, we don't want an arrow
    if (overlap(start, end)) {
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
        // The target is entirely to the right of the center of the draggable.
        // We will go for one of the left corners of the target.
        endX = end.offsetLeft;
    } else if (end.offsetLeft + end.offsetWidth < startX) {
        // The target is entirely to the left of the center of the draggable.
        // We will go for one of the right corners of the target.
        endX = end.offsetLeft + end.offsetWidth;
    }
    if (end.offsetTop > startY) {
        // The target is entirely below the center of the draggable.
        // We will go for one of the top corners of the target.
        endY = end.offsetTop;
    } else if (end.offsetTop + end.offsetHeight < startY) {
        // The target is entirely above the center of the draggable.
        // We will go for one of the bottom corners of the target.
        endY = end.offsetTop + end.offsetHeight;
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

    const color = "#80808080";
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

let mouseOffsetFromLeft = 0;
let mouseOffsetFromTop = 0;
let dragTarget: HTMLElement;
//let snapped = false;
let slots: { x: number; y: number; elt: HTMLElement }[] = [];
let snappedToExisting = false;

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
        slots.push({ x, y, elt });
    });
    slots.sort((a, b) => {
        const yDelta = a.y - b.y;
        return yDelta === 0 ? a.x - b.x : yDelta;
    });
    // if (!dragTarget.getAttribute("data-originalLeft")) {
    //     dragTarget.setAttribute(
    //         "data-originalLeft",
    //         target.style.left
    //     );
    //     dragTarget.setAttribute("data-originalTop", target.style.top);
    // }
    mouseOffsetFromLeft = e.clientX / scale - target.offsetLeft;
    mouseOffsetFromTop = e.clientY / scale - target.offsetTop;
    page.addEventListener("mouseup", stopDrag);
    // call a function whenever the cursor moves:
    page.addEventListener("mousemove", elementDrag);
};
const snapDelta = 30; // review: how close do we want?
const elementDrag = (e: MouseEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    e.preventDefault();
    // Where will we move the target to? If no snaps, we move it to stay in the same place
    // relative to the mouse.
    let x = e.clientX / scale - mouseOffsetFromLeft;
    let y = e.clientY / scale - mouseOffsetFromTop;
    let deltaMin = Number.MAX_VALUE;
    let deltaRowMin = Number.MAX_VALUE;
    const width = dragTarget.offsetWidth;
    snappedToExisting = false;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const deltaX = slot.x - x;
        const deltaY = slot.y - y;
        const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        // It's interesting if it is dropped on top of another target(or where it started),
        // but only if that target is in a row.
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
        // Right of it's own start position, which is likely in range initially, is not interesting.
        if (slot.elt === dragTarget) {
            continue;
        }
        let spacing = width + 15;
        if (inRow) {
            const row = slots.filter(s => s.y === slot.y);
            spacing = row[row.length - 1].x - row[row.length - 2].x;
        }
        const deltaXRow = slot.x + spacing - x;
        const deltaRow = Math.sqrt(deltaXRow * deltaXRow + deltaY * deltaY);
        if (deltaRow < deltaRowMin) {
            deltaRowMin = deltaRow;
            // For a "to the right of" position to be interesting, it must be closer to that
            // position than to any other target
            if (deltaRow < snapDelta && deltaRow < deltaMin) {
                if (inRow) {
                    // If there isn't already a row, we'd only be guessing at spacing
                    // so don't snap in that direction.
                    x = slot.x + spacing;
                }
                y = slot.y;
                snappedToExisting = false;
            }
        }
    }
    // Todo: if snappedToExisting, move things around.

    // Todo: something intelligent if we snapped an item that is already in the row to a position beyond the end of the row.
    dragTarget.style.top = y + "px";
    dragTarget.style.left = x + "px";

    const targetId = dragTarget.getAttribute("data-target-of");
    if (targetId) {
        const draggable = page.querySelector(`[data-bubble-id="${targetId}"]`);
        if (draggable) {
            adjustTarget(draggable as HTMLElement, dragTarget);
        }
    }
};
const stopDrag = (e: MouseEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    if (snappedToExisting) {
        // Move things around so we end up with an evenly spaced row again.
        const row = slots.filter(s => s.y === dragTarget.offsetTop);
        const indexDroppedOn = row.findIndex(
            s => s.x === dragTarget.offsetLeft
        );
        const indexDragged = row.findIndex(s => s.elt === dragTarget);
        const spacing = row[row.length - 1].x - row[row.length - 2].x;
        if (indexDragged < 0) {
            // Not in the row previously, move others over.
            for (let i = row.length - 1; i >= indexDroppedOn; i--) {
                row[i].elt.style.left = `${row[i].x + spacing}px`;
            }
        } else if (indexDroppedOn < indexDragged) {
            // Move others over.
            for (let i = indexDragged - 1; i >= indexDroppedOn; i--) {
                row[i].elt.style.left = `${row[i].x + spacing}px`;
            }
        } else {
            // Move others over.
            for (let i = indexDragged + 1; i <= indexDroppedOn; i++) {
                row[i].elt.style.left = `${row[i].x - spacing}px`;
            }
        }
    }
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
            css={css`
                color: ${kBloomBlue};
                background-color: white;
                padding-left: 5px;
            `}
            initiallyOpen={true}
            buttonColor={kBloomBlue}
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

const correctTabIndex = 1;
const wrongTabIndex = 2;
const tryItTabIndex = 3;
let positionsToRestore: { x: string; y: string; elt: HTMLElement }[] = [];
const savePositions = (page: HTMLElement) => {
    positionsToRestore = [];
    page.querySelectorAll("[data-bubble-id]").forEach((elt: HTMLElement) => {
        positionsToRestore.push({
            x: elt.style.left,
            y: elt.style.top,
            elt
        });
    });
};
const restorePositions = () => {
    positionsToRestore.forEach(p => {
        p.elt.style.left = p.x;
        p.elt.style.top = p.y;
    });
    positionsToRestore = [];
};

const updateTabClass = (tabIndex: number) => {
    const pageBody = ToolBox.getPage();
    if (!pageBody) {
        // try again in a bit (this might happen if the toolbox iframe loads faster than the page iframe)
        setTimeout(() => {
            updateTabClass(tabIndex);
        }, 100);
        return;
    }
    const classes = [
        "drag-activity-start",
        "drag-activity-correct",
        "drag-activity-wrong",
        "drag-activity-try-it"
    ];
    for (let i = 0; i < classes.length; i++) {
        const className = classes[i];
        if (tabIndex === i) {
            pageBody.classList.add(className);
        } else {
            pageBody.classList.remove(className);
        }
    }
    if (tabIndex === tryItTabIndex) {
        Array.from(
            document.getElementsByClassName("bloom-imageContainer")
        ).forEach(container => {
            (container as HTMLElement).title = "";
        });
    }
};

const DragActivityControls: React.FunctionComponent<{
    activeTab: number;
    onTabChange: (tab: number) => void;
}> = props => {
    useEffect(() => {
        updateTabClass(props.activeTab);
    }, [props.activeTab]);
    const handleChange = (newValue: number) => {
        props.onTabChange(newValue);
        const pageBody = ToolBox.getPage();
        if (!pageBody) {
            return; // throw? By the time we're changing tabs, it should be possible to get the content page.
        }
        const bubbleManager = OverlayTool.bubbleManager();
        const page = pageBody.getElementsByClassName(
            "bloom-page"
        )[0] as HTMLElement;
        if (!page) {
            return; // throw?
        }
        if (newValue === tryItTabIndex) {
            savePositions(page);
            bubbleManager?.suspendComicEditing("forTest");
            prepareActivity(page);
        } else {
            restorePositions(); // in case we are leaving the try-it tab
            const bubbleManager = OverlayTool.bubbleManager();
            bubbleManager?.resumeComicEditing();
        }
        if (newValue === correctTabIndex || newValue === wrongTabIndex) {
            // We can't currently do this for hidden bubbles, and selecting one of these tabs
            // may cause some previously hidden bubbles to become visible.
            bubbleManager?.ensureBubblesIntersectParent(page);
        }
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

    const textItemProps = css`
        margin-left: 5px;
        text-align: center; // Center the text horizontally
        padding: 2px 0.5em;
        vertical-align: middle;
        color: "white";
        background-color: ${kBloomBlue};
        border: 1px dotted ${kBloomBlue};
    `;
    return (
        <ThemeProvider theme={toolboxTheme}>
            <Tabs
                value={props.activeTab}
                onChange={handleChange}
                labels={
                    ["Start", "Correct", "Wrong", "Try It"] /* Todo: localize*/
                }
            />
            {props.activeTab === 0 && (
                <div>
                    <Div l10nKey="SceneInstructions" />
                    <OverlayItemRegion
                        l10nKey="EditTab.Toolbox.DragActivity.Draggable"
                        theme="blueOnTan"
                    >
                        <OverlayItemRow>
                            <OverlayTextItem
                                css={textItemProps}
                                l10nKey="EditTab.Toolbox.DragActivity.Letter"
                                style="none"
                                draggable={true}
                                addClasses="draggable-text"
                            />
                            <OverlayTextItem
                                css={textItemProps}
                                l10nKey="EditTab.Toolbox.DragActivity.Word"
                                style="none"
                                draggable={true}
                                addClasses="draggable-text"
                            />{" "}
                            <OverlayImageItem
                                style="image"
                                draggable={true}
                                color={kBloomBlue}
                                strokeColor={kBloomBlue}
                            />
                        </OverlayItemRow>
                    </OverlayItemRegion>
                    <OverlayItemRegion
                        l10nKey="EditTab.Toolbox.DragActivity.FixedInPlace"
                        theme="blueOnTan"
                    >
                        <OverlayItemRow>
                            <OverlayTextItem
                                css={textItemProps}
                                l10nKey="EditTab.Toolbox.DragActivity.InstructionsOrLabels"
                                style="none"
                                draggable={false}
                            />
                        </OverlayItemRow>
                        <OverlayItemRow>
                            <OverlayImageItem
                                style="image"
                                draggable={false}
                                color={kBloomBlue}
                                strokeColor={kBloomBlue}
                            />
                            <OverlayButtonItem
                                l10nKey="EditTab.Toolbox.DragActivity.CheckAnswer"
                                addClasses="check-button"
                                contentL10nKey="EditTab.Toolbox.DragActivity.Check"
                                hintL10nKey="EditTab.Toolbox.DragActivity.CheckHint"
                            />
                        </OverlayItemRow>
                    </OverlayItemRegion>
                </div>
            )}

            {props.activeTab === 1 && (
                <div>
                    <Instructions l10nKey="CorrectInstructions" />
                    <OverlayItemRegion theme="blueOnTan" l10nKey="">
                        <OverlayItemRow>
                            <OverlayImageItem
                                style="image"
                                draggable={false}
                                addClasses="drag-item-correct"
                                color={kBloomBlue}
                                strokeColor={kBloomBlue}
                            />
                        </OverlayItemRow>
                        <OverlayItemRow>
                            <OverlayTextItem
                                css={textItemProps}
                                l10nKey="EditTab.Toolbox.DragActivity.TextToPutOnThePage"
                                style="none"
                                draggable={false}
                                addClasses="drag-item-correct"
                            />
                        </OverlayItemRow>
                    </OverlayItemRegion>
                </div>
            )}
            {props.activeTab === 2 && (
                <div>
                    <Instructions l10nKey="WrongInstructions" />
                    <OverlayItemRegion theme="blueOnTan" l10nKey="">
                        <OverlayItemRow>
                            <OverlayImageItem
                                style="image"
                                draggable={false}
                                addClasses="drag-item-wrong"
                                color={kBloomBlue}
                                strokeColor={kBloomBlue}
                            />
                        </OverlayItemRow>
                        <OverlayItemRow>
                            <OverlayButtonItem
                                l10nKey="EditTab.Toolbox.DragActivity.TryAgain"
                                addClasses="try-again-button drag-item-wrong"
                                contentL10nKey="EditTab.Toolbox.DragActivity.TryAgain"
                            />
                            <OverlayButtonItem
                                l10nKey="EditTab.Toolbox.DragActivity.ShowAnswer"
                                addClasses="show-correct-button drag-item-wrong"
                                contentL10nKey="EditTab.Toolbox.DragActivity.ShowAnswer"
                            />
                        </OverlayItemRow>
                        <OverlayItemRow>
                            <OverlayTextItem
                                css={textItemProps}
                                l10nKey="EditTab.Toolbox.DragActivity.TextToPutOnThePage"
                                style="none"
                                draggable={false}
                                addClasses="drag-item-wrong"
                            />
                        </OverlayItemRow>
                    </OverlayItemRegion>
                </div>
            )}
            {props.activeTab === 3 && (
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

    private root: HTMLDivElement | undefined;
    private tab = 0;

    public makeRootElement(): HTMLDivElement {
        this.root = document.createElement("div") as HTMLDivElement;
        //root.setAttribute("class", "DragActivityBody");

        this.renderRoot();
        return this.root;
    }

    private renderRoot(): void {
        if (!this.root) return;
        ReactDOM.render(
            <DragActivityControls
                activeTab={this.tab}
                onTabChange={tab => {
                    this.tab = tab;
                    // We are controlling this property, so the only way it gets into
                    // the other tab is when we change it.
                    this.renderRoot();
                }}
            />,
            this.root
        );
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
        const bubbleManager = OverlayTool.bubbleManager();
        const page = DragActivityTool.getBloomPage();
        if (!bubbleManager || !page) {
            // probably the toolbox just finished loading before the page.
            // No clean way to fix this
            window.setTimeout(() => this.newPageReady(), 100);
            return;
        }
        // useful during development, MAY not need in production.
        bubbleManager.removeDetachedTargets();

        setupDraggingTargets(page);
        //updateTabClass(this.tab);
        // Force things to Start tab as we change page.
        // If we decide not to do this, we should probably at least find a way to do it
        // when it's a brand newly-created page.
        if (this.tab != 0) {
            // We can't get at or modify the activeTab state of the DragActivityControls
            // component, so this is the easiest way I can find to get the page in a consistent state.
            // If we want to mantain the tab setting through page changes, we'll have to maintain
            // the state here and pass it to the component along with an onChange handler.
            this.tab = 0;
            this.renderRoot();
        }
    }

    public detachFromPage() {
        // We don't want to leave the page in a state where things have been moved during testing.
        // Especially we don't want to save it that way.
        restorePositions();
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
