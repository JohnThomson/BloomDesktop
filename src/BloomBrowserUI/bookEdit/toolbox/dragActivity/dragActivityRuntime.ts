// This is the code that is shared between the test tab of the toolbox and bloom-player.

import { get } from "jquery";

let slots: { x: number; y: number }[] = [];
let originalPositions = new Map<HTMLElement, { x: number; y: number }>();
export function prepareActivity(page: HTMLElement) {
    slots = [];
    originalPositions = new Map<HTMLElement, { x: number; y: number }>();
    page.querySelectorAll("[data-bubble-id]").forEach((elt: HTMLElement) => {
        const targetId = elt.getAttribute("data-bubble-id");
        const target = page.querySelector(
            `[data-target-of="${targetId}"]`
        ) as HTMLElement;
        if (!target) {
            return;
        }
        const x = target.offsetLeft;
        const y = target.offsetTop;
        slots.push({ x, y });
        originalPositions.set(elt, { x: elt.offsetLeft, y: elt.offsetTop });
        // Todo: these should get cleaned up.
        elt.addEventListener("mousedown", startDrag);
    });
    let checkButtons = Array.from(page.getElementsByClassName("check-button"));
    const tryAgainButtons = Array.from(
        page.getElementsByClassName("try-again-button")
    );
    const showCorrectButtons = Array.from(
        page.getElementsByClassName("show-correct-button")
    );

    checkButtons.concat(tryAgainButtons).forEach((elt: HTMLElement) => {
        elt.addEventListener("click", performCheck);
    });
    showCorrectButtons.forEach((elt: HTMLElement) => {
        elt.addEventListener("click", () => {
            page.querySelectorAll("[data-bubble-id]").forEach(
                (elt: HTMLElement) => {
                    const targetId = elt.getAttribute("data-bubble-id");
                    const target = page.querySelector(
                        `[data-target-of="${targetId}"]`
                    ) as HTMLElement;
                    if (!target) {
                        return;
                    }
                    const x = target.offsetLeft;
                    const y = target.offsetTop;
                    elt.style.left = x + "px";
                    elt.style.top = y + "px";
                }
            );
        });
    });
}

let dragStartX = 0;
let dragStartY = 0;
let dragTarget: HTMLElement;
let snapped = false;
let originalLeft = "";
let originalTop = "";

const startDrag = (e: MouseEvent) => {
    // get the mouse cursor position at startup:
    const target = e.currentTarget as HTMLElement;
    dragTarget = target;
    const page = target.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    originalLeft = target.style.left;
    originalTop = target.style.top;
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
    let deltaMin = Number.MAX_VALUE;
    snapped = false;
    for (const slot of slots) {
        const deltaX = slot.x - x;
        const deltaY = slot.y - y;
        const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (delta < deltaMin) {
            deltaMin = delta;
            if (delta < 50) {
                // review: how close do we want?
                x = slot.x;
                y = slot.y;
                snapped = true;
            }
        }
    }
    dragTarget.style.top = y + "px";
    dragTarget.style.left = x + "px";
};
const stopDrag = (e: MouseEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    if (!snapped) {
        dragTarget.style.top = originalTop;
        dragTarget.style.left = originalLeft;
    }
    page.removeEventListener("mouseup", stopDrag);
    page.removeEventListener("mousemove", elementDrag);

    // If there was already a bubble in that slot, move it back to its original position.
    const bubbles = Array.from(page.querySelectorAll("[data-bubble-id]"));
    bubbles.forEach((elt: HTMLElement) => {
        if (elt === dragTarget) {
            return;
        }
        if (
            elt.offsetLeft === dragTarget.offsetLeft &&
            elt.offsetTop === dragTarget.offsetTop
        ) {
            const originalPosition = originalPositions.get(elt);
            if (originalPosition) {
                elt.style.left = originalPosition.x + "px";
                elt.style.top = originalPosition.y + "px";
            }
        }
    });
};

const getVisibleText = (elt: HTMLElement): string => {
    const visibleDivs = elt.getElementsByClassName("bloom-visibility-code-on");
    return Array.from(visibleDivs)
        .map((elt: HTMLElement) => elt.textContent)
        .join(" ");
};

const rightPosition = (elt: HTMLElement, correctX, correctY) => {
    const actualX = elt.offsetLeft;
    const actualY = elt.offsetTop;
    return (
        // Since anything correct should be snapped, this probably isn't necessary
        Math.abs(correctX - actualX) < 0.5 && Math.abs(correctY - actualY) < 0.5
    );
};

export const performCheck = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const page = target.closest(".bloom-page") as HTMLElement;
    let allCorrect = true;
    const bubbles = Array.from(page.querySelectorAll("[data-bubble-id]"));
    bubbles.forEach((elt: HTMLElement) => {
        const targetId = elt.getAttribute("data-bubble-id");
        const target = page.querySelector(
            `[data-target-of="${targetId}"]`
        ) as HTMLElement;
        if (!target) {
            return;
        }

        const correctX = target.offsetLeft;
        const correctY = target.offsetTop;

        if (!rightPosition(elt, correctX, correctY)) {
            // It's not in the expected place. But perhaps one with the same text is?
            const visibleText = getVisibleText(elt);
            if (
                !bubbles.some((bubble: HTMLElement) => {
                    if (bubble === elt) {
                        return false; // already know this bubble is not at the right place
                    }
                    if (getVisibleText(bubble) !== visibleText) {
                        return false; // only interested in ones with the same text
                    }
                    return rightPosition(bubble, correctX, correctY);
                })
            ) {
                allCorrect = false;
            }
        }
    });
    const showWhat = allCorrect
        ? "drag-activity-correct"
        : "drag-activity-wrong";
    page.ownerDocument.body.classList.remove("drag-activity-correct");
    page.ownerDocument.body.classList.remove("drag-activity-wrong");
    page.ownerDocument.body.classList.add(showWhat);
    // Todo: play sound

    return allCorrect;
};
