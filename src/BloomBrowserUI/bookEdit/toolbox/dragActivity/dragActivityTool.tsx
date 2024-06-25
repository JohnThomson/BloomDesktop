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
    kDarkestBackground,
    kOptionPanelBackgroundColor,
    kUiFontStack,
    toolboxTheme
} from "../../../bloomMaterialUITheme";
import { TriangleCollapse } from "../../../react_components/TriangleCollapse";
import { Div } from "../../../react_components/l10nComponents";
import {
    OverlayButtonItem,
    OverlayGifItem,
    OverlayImageItem,
    OverlayItemRegion,
    OverlayItemRow,
    OverlayTextItem,
    OverlayVideoItem,
    OverlayWrongImageItem
} from "../overlay/overlayItem";
import { OverlayTool, deleteBubble } from "../overlay/overlayTool";
import { ToolBox } from "../toolbox";
import {
    classSetter,
    draggingSlider,
    prepareActivity,
    setupWordChooserSlider,
    undoPrepareActivity
} from "./dragActivityRuntime";
import theOneLocalizationManager from "../../../lib/localizationManager/localizationManager";
import { postData, postJson } from "../../../utils/bloomApi";
import {
    getEditablePageBundleExports,
    getToolboxBundleExports
} from "../../editViewFrame";
import { MenuItem, Select, menuClasses } from "@mui/material";
import { useL10n } from "../../../react_components/l10nHooks";
import { BloomTooltip } from "../../../react_components/BloomToolTip";
import {
    DragActivityTabControl,
    renderDragActivityTabControl
} from "./DragActivityTabControl";
import { default as TrashIcon } from "@mui/icons-material/Delete";
import { BubbleSpec } from "comicaljs";

export const Tabs: React.FunctionComponent<{
    value: number;
    onChange: (newValue: number) => void;
    labels: string[];
    classNane?: string;
}> = props => {
    const changeHandler = (index: number) => {
        console.log("changeHandler", index);
        props.onChange(index);
    };
    return (
        <div
            css={css`
                display: flex;
                background-color: ${kDarkestBackground};
                padding: 7px 8px 7px 0px;
            `}
            className={props.classNane}
        >
            {props.labels.map((child, index) => {
                const selected = index === props.value;
                return (
                    <button
                        key={child}
                        onClick={() => changeHandler(index)}
                        css={css`
                            font-family: ${kUiFontStack};
                            color: ${selected ? "white" : "lightgray"};
                            background-color: ${selected
                                ? kBloomBlue
                                : kDarkestBackground};
                            border: none;
                            padding: 2px 6px;
                            margin-left: 4px;
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
    if (page.getAttribute("data-activity") === "word-chooser-slider") {
        setupWordChooserSlider(page);
        const wrapper = page.getElementsByClassName(
            "bloom-activity-slider"
        )[0] as HTMLElement;
        wrapper.addEventListener("click", designTimeClickOnSlider);
    }
};

const removeDraggingTargets = (startingPoint: HTMLElement) => {
    const page = startingPoint.closest(".bloom-page") as HTMLElement;
    page.querySelectorAll("[data-target-of]").forEach((elt: HTMLElement) => {
        elt.removeEventListener("mousedown", startDrag);
    });
    if (page.getAttribute("data-activity") === "word-chooser-slider") {
        const wrapper = page.getElementsByClassName(
            "bloom-activity-slider"
        )[0] as HTMLElement;
        wrapper.removeEventListener("click", designTimeClickOnSlider);
    }
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
    draggable: HTMLElement,
    target: HTMLElement | undefined,
    forceAdjustAll?: boolean
) => {
    let arrow = (draggable.ownerDocument.getElementById(
        "target-arrow"
    ) as unknown) as SVGSVGElement;
    if (!target) {
        if (arrow) {
            arrow.remove();
        }
        return;
    }
    // if the target is not the same size, presumably the draggable size changed, in which case
    // we need to adjust the target, and possibly all other targets and draggables on the page.
    let adjustAll = forceAdjustAll ?? false;
    if (target.offsetHeight !== draggable.offsetHeight) {
        target.style.height = `${draggable.offsetHeight}px`;
        adjustAll = true;
    }
    if (target.offsetWidth !== draggable.offsetWidth) {
        target.style.width = `${draggable.offsetWidth}px`;
        adjustAll = true;
    }

    // Resize everything, unless that behavior is turned off.
    // Enhance: possibly we should only resize the ones that are initially the same size as the
    // target used to be?
    if (
        adjustAll &&
        draggable.closest(".bloom-page")!.getAttribute("data-same-size") !==
            "false"
    ) {
        // We need to adjust the position of all the other targets.
        const page = draggable.closest(".bloom-page") as HTMLElement;
        const otherDraggables = Array.from(
            page.querySelectorAll("[data-bubble-id]")
        ).filter(x => x !== draggable);
        const otherTargets = Array.from(
            page.querySelectorAll("[data-target-of]")
        ).filter(x => x !== target);
        otherDraggables.concat(otherTargets).forEach((elt: HTMLElement) => {
            if (elt.offsetHeight !== draggable.offsetHeight) {
                elt.style.height = `${draggable.offsetHeight}px`;
            }
            if (elt.offsetWidth !== draggable.offsetWidth) {
                elt.style.width = `${draggable.offsetWidth}px`;
            }
        });
    }
    // if start and end overlap, we don't want an arrow
    if (overlap(draggable, target)) {
        if (arrow) {
            arrow.remove();
        }
        return;
    }
    //const scale = page.getBoundingClientRect().width / page.offsetWidth;
    // These values make a line from the center of the start to the center of the end.
    const startX = draggable.offsetLeft + draggable.offsetWidth / 2;
    const startY = draggable.offsetTop + draggable.offsetHeight / 2;
    const endXCenter = target.offsetLeft + target.offsetWidth / 2;
    const endYCenter = target.offsetTop + target.offsetHeight / 2;
    let endX = endXCenter;
    let endY = endYCenter;
    if (target.offsetLeft > startX) {
        // The target is entirely to the right of the center of the draggable.
        // We will go for one of the left corners of the target.
        endX = target.offsetLeft;
    } else if (target.offsetLeft + target.offsetWidth < startX) {
        // The target is entirely to the left of the center of the draggable.
        // We will go for one of the right corners of the target.
        endX = target.offsetLeft + target.offsetWidth;
    }
    if (target.offsetTop > startY) {
        // The target is entirely below the center of the draggable.
        // We will go for one of the top corners of the target.
        endY = target.offsetTop;
    } else if (target.offsetTop + target.offsetHeight < startY) {
        // The target is entirely above the center of the draggable.
        // We will go for one of the bottom corners of the target.
        endY = target.offsetTop + target.offsetHeight;
    }

    if (!arrow) {
        arrow = draggable.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );
        arrow.setAttribute("id", "target-arrow");
        draggable.parentElement!.appendChild(arrow);
    }

    // But we actually want border to border
    // If the line runs through the top or bottom border:
    const yMultiplier = startY < endY ? 1 : -1;
    const deltaYTB = (draggable.offsetHeight / 2) * yMultiplier;
    const startYTB = startY + deltaYTB;
    // If it's a horizontal arrow, we won't be using this, but we need to avoid dividing by zero and get a really big number
    const deltaXTB =
        endY === startY
            ? 10000000
            : ((startYTB - startY) * (endX - startX)) / (endY - startY);
    const startXTB = startX + deltaXTB;

    // If the line runs through the left or right border:
    const xMultiplier = startX < endX ? 1 : -1;
    const deltaXLR = (draggable.offsetWidth / 2) * xMultiplier;
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
        line = draggable.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );
        arrow.appendChild(line);
        line2 = draggable.ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );
        arrow.appendChild(line2);
        line3 = draggable.ownerDocument.createElementNS(
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
    // The arrow is "on top" of the targets, so if one of them happens to be inside the
    // rectangle that contains the arrow, without this it would not get mouse events.
    arrow.style.pointerEvents = "none";

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
    elementDrag(e); // some side effects like drawing the arrow we want even if no movement happens.
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
        if (indexDragged !== indexDroppedOn) {
            // if equal, we didn't really move it at all.
            const spacing =
                row.length >= 2
                    ? row[row.length - 1].x - row[row.length - 2].x
                    : // We dropped on another target that's not in a row. Create a row.
                      dragTarget.offsetWidth + 15;
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
                padding-left: 5px;
            `}
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

const startTabIndex = 0;
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
    const page = pageBody?.getElementsByClassName(
        "bloom-page"
    )[0] as HTMLElement;
    if (!page) {
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
        "drag-activity-try-it",
        "drag-activity-solution" // doesn't have a tab, but good to remove any time we change.
    ];
    for (let i = 0; i < classes.length; i++) {
        const className = classes[i];
        classSetter(page, className, i === tabIndex);
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
    pageGeneration: number;
}> = props => {
    const [correctSound, setCorrectSound] = useState("");
    const [wrongSound, setWrongSound] = useState("");
    const [soundFolder, setSoundFolder] = useState("");
    const [activityType, setActivityType] = useState("");
    const [allItemsSameSize, setAllItemsSameSize] = useState(true);
    const [showTargetsDuringPlay, setShowTargetsDuringPlay] = useState(true);
    const [currentBubble, setCurrentBuble] = useState<BubbleSpec | undefined>(
        undefined
    );
    const noneSound = useL10n("None", "EditTab.Toolbox.DragActivity.None", "");
    const deleteTooltip = useL10n("Delete", "Common.Delete");
    const chooseSound = useL10n(
        "Choose...",
        "EditTab.Toolbox.DragActivity.ChooseSound",
        ""
    );
    useEffect(() => {
        const bubbleManager = OverlayTool.bubbleManager();
        bubbleManager?.requestBubbleChangeNotification(setCurrentBuble);
    }, []);
    useEffect(() => {
        const getStateFromPage = () => {
            const pageBody = ToolBox.getPage();
            const page = pageBody?.getElementsByClassName(
                "bloom-page"
            )[0] as HTMLElement;
            if (!page) {
                setTimeout(() => {
                    getStateFromPage();
                }, 100);
                return;
            }

            const correctSound = page.getAttribute("data-correct-sound");
            const wrongSound = page.getAttribute("data-wrong-sound");
            setAllItemsSameSize(
                page.getAttribute("data-same-size") !== "false"
            );
            setShowTargetsDuringPlay(
                page.getAttribute("data-show-targets-during-play") !== "false"
            );
            theOneLocalizationManager
                .asyncGetText("EditTab.Toolbox.DragActivity.None", "None", "")
                .then(none => {
                    setCorrectSound(correctSound || none);
                    setWrongSound(wrongSound || none);
                });
            setActivityType(page.getAttribute("data-activity") ?? "");
        };
        getStateFromPage();
    }, [props.pageGeneration]);
    const getPage = () => {
        const pageBody = ToolBox.getPage();
        return pageBody?.getElementsByClassName("bloom-page")[0] as HTMLElement;
    };
    const showDialogToChooseSoundFile = async forCorrect => {
        const result = await postJson("fileIO/chooseFile", {
            title: "Choose Sound File",
            fileTypes: [
                {
                    name: "MP#",
                    extensions: ["mp3"]
                }
            ],
            defaultPath: soundFolder,
            destFolder: "audio"
        });
        if (!result || !result.data) {
            return;
        }
        const page = getPage();
        setSoundFolder(result.data);
        if (forCorrect) {
            setCorrectSound(result.data);
            page.setAttribute("data-correct-sound", result.data);
        } else {
            setWrongSound(result.data);
            page.setAttribute("data-wrong-sound", result.data);
        }
        playSound(result.data, page);
    };
    useEffect(() => {
        updateTabClass(props.activeTab);
    }, [props.activeTab]);

    // Souns "Yay", and below "Awww", "Oh-oh". amd "Waah" were taken from https://bloomlibrary.org/EFL-education-for-life-org/EFL-CatandDog/book/8ItXq7Rp5s.
    // We need to investigate licensing before we ship. The book (10 - Cat and Dog and the egg) is CC-BY-NC, and the activities, to which the
    // sounds presumably belong, are CC-BY-NC-SA. This may mean they are copyright by the owners of Active Presenter 8 or SIL-PNG
    // and we can't use them for just any book that wants them, therefore probably not at all. Also, if we can use them, we may need
    // (based on NC) to determine how the source should be acknowledged.
    // It's not clear from the credits page of the book, unfortunately.
    // I don't know the source of "Ding-a-ling" or "Sad Drum", but I think they are sounds we were already using for activities, so
    // presumably they are OK to use.
    const correctSoundOptions = [
        { label: noneSound, id: "none", divider: false },
        { label: "Ding-a-ling", id: "ding-a-ling.mp3", divider: false },
        { label: "Yay", id: "yay.mp3", divider: true },
        { label: chooseSound, id: "choose", divider: false }
    ];
    if (
        correctSoundOptions.find(opt => opt.id === correctSound) === undefined
    ) {
        correctSoundOptions.splice(0, 0, {
            label: correctSound.replace(/\.mp3$/i, ""),
            id: correctSound,
            divider: false
        });
    }

    const wrongSoundOptions = [
        { label: noneSound, id: "none", divider: false },
        { label: "Awww", id: "awww.mp3", divider: false },
        { label: "Oh-oh", id: "oh-oh.mp3", divider: false },
        { label: "Sad Drum", id: "sad drum.mp3", divider: false },
        { label: "Waah", id: "waah.mp3", divider: true },
        { label: chooseSound, id: "choose", divider: false }
    ];
    if (wrongSoundOptions.find(opt => opt.id === wrongSound) === undefined) {
        wrongSoundOptions.splice(0, 0, {
            label: wrongSound.replace(/\.mp3$/i, ""),
            id: wrongSound,
            divider: false
        });
    }

    const [dragObjectType, setDragObjectType] = useState("text");
    // Todo: something has to call setDragObjectType when a draggable is selected.
    let titleId = "EditTab.Toolbox.DragActivity.Draggable";
    if (dragObjectType === "dragTarget") {
        titleId = "EditTab.Toolbox.DragActivity.DraggableTarget";
    } else if (dragObjectType === "orderCircle") {
        titleId = "EditTab.Toolbox.DragActivity.OrderCircle";
    }

    const onSoundItemChosen = (forCorrect: boolean, newSoundId: string) => {
        if (newSoundId === "choose") {
            showDialogToChooseSoundFile(forCorrect);
            return;
        }
        if (
            (newSoundId === correctSound && forCorrect) ||
            (newSoundId === wrongSound && !forCorrect)
        ) {
            // Nothing is changing; also, we don't want to try to copy the sound file again, especially if it
            // is a user-chosen one that we won't find in our sounds folder.
            return;
        }
        const page = getPage();
        if (forCorrect) {
            setCorrectSound(newSoundId);
            if (newSoundId === "none") {
                page.removeAttribute("data-correct-sound");
            } else {
                page.setAttribute("data-correct-sound", newSoundId);
            }
        } else {
            setWrongSound(newSoundId);
            if (newSoundId === "none") {
                page.removeAttribute("data-wrong-sound");
            } else {
                page.setAttribute("data-wrong-sound", newSoundId);
            }
        }
        if (newSoundId !== "none") {
            // I think copying the sound can be fire-and-forget. But if you add something that needs it to be there,
            // like playing it, you should await this.
            copyBuiltInSound(newSoundId);

            playSound(newSoundId, page);
        }
    };

    const copyBuiltInSound = async (newSoundId: string) => {
        const resultAudioDir = await postJson(
            "fileIO/getSpecialLocation",
            "CurrentBookAudioDirectory"
        );

        if (!resultAudioDir) {
            return; // huh??
        }

        const targetPath = resultAudioDir.data + "/" + newSoundId;
        await postData("fileIO/copyFile", {
            from: encodeURIComponent(newSoundId),
            to: encodeURIComponent(targetPath)
        });
    };

    let correctTabLabels = { instructionsKey: "", headingKey: "" };
    switch (activityType) {
        case "drag-letter-to-target":
            correctTabLabels = {
                instructionsKey: "DragLetterInstructions",
                headingKey: "DragLetterHeading"
            };
            break;
        case "sort-sentence":
            correctTabLabels = {
                instructionsKey: "OrderSentenceInstructions",
                headingKey: "OrderSentenceHeading"
            };
            break;
        case "drag-image-to-target":
            correctTabLabels = {
                instructionsKey: "DragImageInstructions",
                headingKey: "DragImageHeading"
            };
            break;
    }

    // Make a <Select> for choosing a sound file. The arguments allow reusing this both for the correct and wrong sound.
    const soundSelect = (
        forCorrect: boolean,
        options: { label: string; id: string; divider: boolean }[],
        value: string,
        setValue: (fc: boolean, value: string) => void
    ) => {
        return (
            <Select
                css={css`
                    svg.MuiSvgIcon-root {
                        color: white !important;
                    }
                    ul {
                        background-color: ${kOptionPanelBackgroundColor} !important;
                    }
                    fieldset {
                        border-color: rgba(255, 255, 255, 0.5) !important;
                    }
                `}
                size="small"
                value={value}
                sx={{
                    width: 170
                }}
                onChange={event => {
                    const newSoundId = event.target.value as string;
                    setValue(forCorrect, newSoundId);
                }}
                disabled={false}
            >
                {options.map(option => (
                    <MenuItem
                        value={option.id}
                        key={option.id}
                        disabled={false}
                        divider={option.divider}
                    >
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
        );
    };

    const getTarget = (draggable: HTMLElement): HTMLElement | undefined => {
        const targetId = draggable.getAttribute("data-bubble-id");
        if (!targetId) {
            return undefined;
        }
        return getPage()?.querySelector(
            `[data-target-of="${targetId}"]`
        ) as HTMLElement;
    };

    const toggleAllSameSize = () => {
        const newAllSameSize = !allItemsSameSize;
        setAllItemsSameSize(newAllSameSize);
        const page = getPage();
        page.setAttribute("data-same-size", newAllSameSize ? "true" : "false");
        if (newAllSameSize) {
            const bm = OverlayTool.bubbleManager()!;
            let someDraggable = bm.getActiveElement(); // prefer the selected one
            if (
                !someDraggable ||
                !someDraggable.getAttribute("data-bubble-id")
            ) {
                // find something
                someDraggable = page.querySelector(
                    "[data-bubble-id]"
                ) as HTMLElement;
            }
            if (!someDraggable) {
                return;
            }
            adjustTarget(someDraggable, getTarget(someDraggable), true);
        }
    };

    const toggleShowTargetsDuringPlay = () => {
        const newShowTargetsDuringPlay = !showTargetsDuringPlay;
        setShowTargetsDuringPlay(newShowTargetsDuringPlay);
        const page = getPage();
        page.setAttribute(
            "data-show-targets-during-play",
            newShowTargetsDuringPlay ? "true" : "false"
        );
    };

    const textItemProps = css`
        margin-left: 5px;
        text-align: center; // Center the text horizontally
        padding: 2px 0.5em;
        vertical-align: middle;
        color: "white";
        background-color: ${kBloomBlue};
        border: 1px dotted ${kBloomBlue};
    `;

    const playAudioCss = css`
        margin-left: 10px;
        margin-top: 10px;
    `;
    const anyDraggables = activityType !== "sort-sentence";
    const anyOptions = anyDraggables; // but they might diverge as we do more?
    return (
        <ThemeProvider theme={toolboxTheme}>
            {props.activeTab === 0 && (
                <div>
                    {anyDraggables && (
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
                                    hide={
                                        activityType ===
                                            "word-chooser-slider" ||
                                        activityType === "drag-image-to-target"
                                    }
                                    userDefinedStyleName="Letter"
                                />
                                <OverlayTextItem
                                    css={textItemProps}
                                    l10nKey="EditTab.Toolbox.DragActivity.Word"
                                    style="none"
                                    draggable={true}
                                    addClasses="draggable-text"
                                    hide={
                                        activityType ===
                                            "word-chooser-slider" ||
                                        activityType ===
                                            "drag-letter-to-target" ||
                                        activityType === "drag-image-to-target"
                                    }
                                    userDefinedStyleName="Word"
                                />{" "}
                                {activityType !== "drag-letter-to-target" && (
                                    <OverlayImageItem
                                        style="image"
                                        draggable={
                                            activityType !==
                                            "word-chooser-slider"
                                        }
                                        matchingTextBox={
                                            activityType ===
                                            "word-chooser-slider"
                                        }
                                        color={kBloomBlue}
                                        strokeColor={kBloomBlue}
                                    />
                                )}
                                {activityType === "word-chooser-slider" && (
                                    <OverlayWrongImageItem
                                        style="image"
                                        draggable={false}
                                        matchingTextBox={false}
                                        color={kBloomBlue}
                                        strokeColor={kBloomBlue}
                                        // without this it won't be initially visible
                                        addClasses="bloom-activePicture"
                                        extraAction={bubble =>
                                            bubble.setAttribute(
                                                "data-img-txt",
                                                "wrong"
                                            )
                                        }
                                    />
                                )}
                            </OverlayItemRow>
                            {/* If we want this at all, it would only be in the sort-sentence activity
                            <OverlayTextItem
                                css={textItemProps}
                                l10nKey="EditTab.Toolbox.DragActivity.OrderSentence"
                                style="none"
                                draggable={false}
                                addClasses="drag-item-order-sentence"
                            />
                        </OverlayItemRow> */}
                        </OverlayItemRegion>
                    )}
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
                            {/* <OverlayButtonItem
                                l10nKey="EditTab.Toolbox.DragActivity.CheckAnswer"
                                addClasses="check-button"
                                contentL10nKey="EditTab.Toolbox.DragActivity.Check"
                                hintL10nKey="EditTab.Toolbox.DragActivity.CheckHint"
                                userDefinedStyleName="GameButton"
                            /> */}
                        </OverlayItemRow>
                        <OverlayItemRow>
                            <OverlayVideoItem
                                style="video"
                                color={kBloomBlue}
                            />
                            <OverlayGifItem
                                style="image"
                                strokeColor={kBloomBlue}
                            />
                        </OverlayItemRow>
                    </OverlayItemRegion>
                </div>
            )}
            {props.activeTab === 0 && (
                <div
                    css={css`
                        margin-left: 10px;
                    `}
                >
                    {correctTabLabels.headingKey && (
                        <Div
                            css={css`
                                margin-top: 10px;
                                font-weight: bold;
                                font-size: larger;
                            `}
                            l10nKey={
                                "EditTab.Toolbox.DragActivity." +
                                correctTabLabels.headingKey
                            }
                        ></Div>
                    )}
                    {correctTabLabels.instructionsKey && (
                        <Instructions
                            l10nKey={correctTabLabels.instructionsKey}
                        />
                    )}
                    {anyOptions && (
                        <Div
                            css={css`
                                margin-top: 10px;
                            `}
                            l10nKey="EditTab.Toolbox.DragActivity.Options"
                        ></Div>
                    )}
                    {anyOptions && (
                        <div
                            css={css`
                                display: flex;
                                margin-top: 5px;
                            `}
                        >
                            <BloomTooltip
                                id="sameSize"
                                placement="top-end"
                                tip={
                                    <Div l10nKey="EditTab.Toolbox.DragActivity.SameSize"></Div>
                                }
                            >
                                <div
                                    css={css`
                                        background-color: ${allItemsSameSize
                                            ? kBloomBlue
                                            : "transparent"};
                                        padding: 6px;
                                        margin-right: 10px;
                                    `}
                                    onClick={toggleAllSameSize}
                                >
                                    <img src="images/uniform sized targets.svg"></img>
                                </div>
                            </BloomTooltip>
                            <BloomTooltip
                                id="sameSize"
                                placement="top-end"
                                tip={
                                    <Div l10nKey="EditTab.Toolbox.DragActivity.ShowTargetsPlay"></Div>
                                }
                            >
                                <div
                                    css={css`
                                        background-color: ${showTargetsDuringPlay
                                            ? kBloomBlue
                                            : "transparent"};
                                        padding: 6px;
                                    `}
                                    onClick={toggleShowTargetsDuringPlay}
                                >
                                    <img src="images/Show Targets During Play.svg"></img>
                                </div>
                            </BloomTooltip>
                        </div>
                    )}
                </div>
            )}

            {props.activeTab === 1 && (
                <div>
                    <OverlayItemRegion theme="blueOnTan" l10nKey="">
                        <OverlayItemRow>
                            <OverlayImageItem
                                style="image"
                                draggable={false}
                                addClasses="drag-item-correct"
                                color={kBloomBlue}
                                strokeColor={kBloomBlue}
                            />
                            <OverlayVideoItem
                                style="video"
                                color={kBloomBlue}
                                addClasses="drag-item-correct"
                            />
                            <OverlayGifItem
                                style="image"
                                strokeColor={kBloomBlue}
                                addClasses="drag-item-correct"
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
                    <Instructions l10nKey="CorrectInstructions" />
                    <div css={playAudioCss}>
                        <Div l10nKey="EditTab.Toolbox.DragActivity.WhenCorrect" />
                        <Div
                            css={css`
                                margin-top: 10px;
                            `}
                            l10nKey="EditTab.Toolbox.DragActivity.PlayAudio"
                        />

                        {soundSelect(
                            true,
                            correctSoundOptions,
                            correctSound,
                            onSoundItemChosen
                        )}
                    </div>
                </div>
            )}
            {props.activeTab === 2 && (
                <div>
                    <OverlayItemRegion theme="blueOnTan" l10nKey="">
                        <OverlayItemRow>
                            <OverlayImageItem
                                style="image"
                                draggable={false}
                                addClasses="drag-item-wrong"
                                color={kBloomBlue}
                                strokeColor={kBloomBlue}
                            />
                            <OverlayVideoItem
                                style="video"
                                color={kBloomBlue}
                                addClasses="drag-item-wrong"
                            />
                            <OverlayGifItem
                                style="image"
                                strokeColor={kBloomBlue}
                                addClasses="drag-item-wrong"
                            />
                        </OverlayItemRow>
                        {/* <OverlayItemRow>
                            <OverlayButtonItem
                                l10nKey="EditTab.Toolbox.DragActivity.TryAgain"
                                addClasses="try-again-button drag-item-wrong"
                                contentL10nKey="EditTab.Toolbox.DragActivity.TryAgain"
                                userDefinedStyleName="GameButton"
                            />
                            <OverlayButtonItem
                                l10nKey="EditTab.Toolbox.DragActivity.ShowAnswer"
                                addClasses="show-correct-button drag-item-wrong"
                                contentL10nKey="EditTab.Toolbox.DragActivity.ShowAnswer"
                                userDefinedStyleName="GameButton"
                            />
                        </OverlayItemRow> */}
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
                    <Instructions l10nKey="WrongInstructions" />
                    <div css={playAudioCss}>
                        <Div l10nKey="EditTab.Toolbox.DragActivity.WhenWrong" />
                        <Div
                            css={css`
                                margin-top: 10px;
                            `}
                            l10nKey="EditTab.Toolbox.DragActivity.PlayAudio"
                        />
                        {soundSelect(
                            false,
                            wrongSoundOptions,
                            wrongSound,
                            onSoundItemChosen
                        )}
                    </div>
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
            {props.activeTab !== 3 && (
                <div>
                    <div
                        title={deleteTooltip}
                        css={css`
                            margin: 10px;
                            ${currentBubble // like definition of .disabled in toolbox.less
                                ? ""
                                : "opacity:0.4; pointer-events:none;"};
                        `}
                    >
                        <TrashIcon
                            id="trashIcon"
                            color="primary"
                            onClick={() => deleteBubble()}
                        />
                    </div>
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

    public setActiveTab(tab: number) {
        this.tab = tab;
        this.renderRoot();
    }

    // Activating the tool calls this right before newPageReady().
    // Currently the latter does this.renderRoot(), so we don't need to do it here.
    // public showTool() {
    //     this.renderRoot();
    // }

    public requiresToolId(): boolean {
        return true;
    }

    private root: HTMLDivElement | undefined;
    private tab = 0;

    public makeRootElement(): HTMLDivElement {
        this.root = document.createElement("div") as HTMLDivElement;
        //root.setAttribute("class", "DragActivityBody");

        this.renderRoot();
        return this.root;
    }

    private pageGeneration = 0;

    private renderRoot(): void {
        if (!this.root) return;
        this.pageGeneration++;
        ReactDOM.render(
            <DragActivityControls
                activeTab={this.tab}
                onTabChange={tab => {
                    this.tab = tab;
                    // We are controlling this property, so the only way it gets into
                    // the other tab is when we change it.
                    this.renderRoot();
                }}
                pageGeneration={this.pageGeneration}
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

    private lastPageId = "";

    public newPageReady() {
        const bubbleManager = OverlayTool.bubbleManager();
        const page = DragActivityTool.getBloomPage();
        const pageFrameExports = getEditablePageBundleExports();
        if (!bubbleManager || !page || !pageFrameExports) {
            // probably the toolbox just finished loading before the page.
            // No clean way to fix this
            window.setTimeout(() => this.newPageReady(), 100);
            return;
        }

        const pageId = page.getAttribute("id") ?? "";
        if (pageId === this.lastPageId) {
            // reinitialize for the current tab. This is especially important in Try It mode,
            // because detachFromPage() undoes some of the initialization for that tab.
            const currentTab = getActiveDragActivityTab();
            console.log("reinitializing tab ", currentTab);
            setActiveDragActivityTab(currentTab);
        } else {
            console.log("initializing new page");
            this.lastPageId = pageId;
            // useful during development, MAY not need in production.
            bubbleManager.removeDetachedTargets();
            setTimeout(() => {
                this.copyInitialText();
            }, 100);

            // Force things to Start tab as we change page.
            // If we decide not to do this, we should probably at least find a way to do it
            // when it's a brand newly-created page.
            setActiveDragActivityTab(0);
        }
    }

    // Elements marked with bloom-init-L1 are not allowed to be empty. Usually they are initially,
    // unless L1 is English, so we copy the English content to them. This is a pretty horrid thing
    // to do, since the block is tagged to indicate that it's another language, but for these kinds
    // of fields the source bubble, which only shows up on an overlay page when the item is selected,
    // is not enough hint. We hope the user will edit appropriately.
    private copyInitialText() {
        const page = DragActivityTool.getBloomPage();
        if (!page) {
            return;
        }
        const groupsToInit = page.getElementsByClassName("bloom-init-L1");
        for (let i = 0; i < groupsToInit.length; i++) {
            const group = groupsToInit[i] as HTMLElement;
            const l1editable = group.getElementsByClassName(
                "bloom-content1"
            )[0];
            if (
                !l1editable ||
                l1editable.textContent?.replace(/\s/g, "") !== ""
            ) {
                continue;
            }
            const enContent = Array.from(
                group.getElementsByClassName("bloom-editable")
            ).find(e => e.getAttribute("lang") === "en");
            if (enContent) {
                l1editable.innerHTML = enContent.innerHTML;
            }
        }
    }

    public detachFromPage() {
        // We don't want to leave the page in a state where things have been moved during testing.
        // Especially we don't want to save it that way.
        restorePositions();
        const page = DragActivityTool.getBloomPage();
        if (page) {
            undoPrepareActivity(page);
        }
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
}
function playSound(newSoundId: string, page: HTMLElement) {
    const audio = new Audio("audio/" + newSoundId);
    audio.style.visibility = "hidden";
    audio.classList.add("bloom-ui"); // so it won't be saved, even if we fail to remove it otherwise

    // To my surprise, in BP storybook it works without adding the audio to any document.
    // But in Bloom proper, it does not. I think it is because this code is part of the toolbox,
    // so the audio element doesn't have the right context to interpret the relative URL.
    page.append(audio);
    // It feels cleaner if we remove it when done. This could fail, e.g., if the user
    // switches tabs or pages before we get done playing. Removing it immediately
    // prevents the sound being played. It's not a big deal if it doesn't get removed.
    audio.onended = () => {
        page.removeChild(audio);
    };
    audio.play();
}

function designTimeClickOnSlider(this: HTMLElement, ev: MouseEvent) {
    if (draggingSlider) {
        return;
    }
    const target = ev.target as HTMLElement;
    // If they click on the wrong one in try-it mode, don't select it.
    if (target.closest(".drag-activity-try-it")) {
        return;
    }
    const src = target.getAttribute("src");
    const id = target.getAttribute("data-img");
    if (!id) {
        return;
    }
    const possibleBubbles = Array.from(
        target.ownerDocument.querySelectorAll("[data-img-txt='" + id + "']")
    );
    // usually there will only be one possibleBubble, but all the 'wrong' ones have the same data-img-txt.
    const bubbleToSelect = possibleBubbles.find(
        b => b.getElementsByTagName("img")[0].getAttribute("src") === src
    );
    if (bubbleToSelect) {
        OverlayTool.bubbleManager()?.setActiveElement(
            bubbleToSelect as HTMLElement
        );
    }
}

const dragActivityTypes = [
    "word-chooser-slider",
    "drag-to-destination",
    "sort-sentence",
    "drag-letter-to-target",
    "drag-image-to-target"
];

// After careful thought, I think the right source of truth for which tab is active is a variable on the
// top level window object.
// For a long time it was an attribute of the parent element of the bloom-page. This makes it difficult to
// stay on the same tab when reloading the current page (typically after a Save), since the whole document
// is reloaded.
// I don't want it anywhere in the toolbox, because it is applicable even when the Drag Activity Toolbox is not active.
// In addition to the reason above for not wanting it anywhere in the page iframe,
// I don't want it part of the page, because then I have to take steps to prevent persisting it.
// I don't want it in the element we add to hold the tab control, because it's possible for the page
// to exist before that gets created, and then we have another complication for the toolbox to worry about
// when trying to get it.
// With this new strategy, I think it would be possible to stay on the same tab while changing pages.
// I'm not sure this is desirable. Currently newPageReady() explicitly resets to the Start tab
// if it is loading a different page.
export function getActiveDragActivityTab(): number {
    return window.top!["dragActivityPage"] ?? 0;
}

export function setActiveDragActivityTab(tab: number) {
    window.top!["dragActivityPage"] = tab;
    const page = DragActivityTool.getBloomPage();
    const pageFrameExports = getEditablePageBundleExports();
    if (!page || !pageFrameExports) {
        // just loading page??
        setTimeout(() => {
            console.log(
                "had to postpone setting tab to ",
                tab,
                " because page not ready yet."
            );
            setActiveDragActivityTab(tab);
        }, 100);
        return;
    }
    const parent = page.parentElement;
    if (!parent) {
        console.error("No parent for page");
        return;
    }
    updateTabClass(tab);
    pageFrameExports.renderDragActivityTabControl(tab);
    // Update the toolbox.
    /// Review: might it not exist yet? Do we need a timeout if so?
    // I think we're OK, if for no other reason, because both the dragActivityTool code and the
    // code here agree that we start in the Start tab after switching pages.
    const toolbox = getToolboxBundleExports()?.getTheOneToolbox();
    toolbox?.getTheOneDragActivityTool()?.setActiveTab(tab);

    const bubbleManager = OverlayTool.bubbleManager();
    const wrapper = page.getElementsByClassName(
        "bloom-activity-slider"
    )[0] as HTMLElement;

    if (tab === tryItTabIndex) {
        savePositions(page);
        bubbleManager?.suspendComicEditing("forTest");
        // Enhance: perhaps the next/prev page buttons could do something even here?
        // If so, would we want them to work only in TryIt mode, or always?
        prepareActivity(page, _next => {});
        wrapper?.removeEventListener("click", designTimeClickOnSlider);
    } else {
        undoPrepareActivity(page);
        restorePositions(); // in case we are leaving the try-it tab
        const bubbleManager = OverlayTool.bubbleManager();
        bubbleManager?.resumeComicEditing();
        wrapper?.addEventListener("click", designTimeClickOnSlider);
    }
    if (tab === correctTabIndex || tab === wrongTabIndex) {
        // We can't currently do this for hidden bubbles, and selecting one of these tabs
        // may cause some previously hidden bubbles to become visible.
        bubbleManager?.ensureBubblesIntersectParent(page);
    }
    if (tab === startTabIndex) {
        setupDraggingTargets(page);
    } else {
        removeDraggingTargets(page);
    }
}

export function setupDragActivityTabControl() {
    const page = DragActivityTool.getBloomPage();
    if (!page) {
        return;
    }
    const activityType = page.getAttribute("data-activity") ?? "";
    if (dragActivityTypes.indexOf(activityType) < 0) {
        return;
    }
    const tabControl = page.ownerDocument.createElement("div");
    tabControl.style.position = "relative";
    tabControl.style.top = "-8px";
    tabControl.setAttribute("id", "drag-activity-tab-control");
    const origamiContainer = page.ownerDocument.getElementsByClassName(
        "origami-toggle-container"
    )[0];
    if (!origamiContainer) {
        // if it's not already created, keep trying until it is.
        // We can probably do better than this...the origami method getOrigamiControl() could be renamed
        // something like getControlAbovePage() and moved somewhere sensible and it could be made to
        // create the shell into which we'll render the React element if we want that. But I'm trying to
        // get something ready to demo.
        setTimeout(setupDragActivityTabControl, 200);
        return;
    }
    // This is a weird thing to do, but we want the drag activity controls exactly when we don't
    // want origami, and the origami code already creates a nice wrapper inside the page (so we can
    // get the correct page alignment) and deletes it before saving the page.
    origamiContainer.appendChild(tabControl);
    setActiveDragActivityTab(getActiveDragActivityTab());
}
