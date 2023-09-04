// This is the code that is shared between the test tab of the toolbox and bloom-player.

import { get } from "jquery";

let slots: { x: number; y: number }[] = [];
let originalPositions = new Map<HTMLElement, { x: number; y: number }>();
let currentPage: HTMLElement | undefined;
export function prepareActivity(page: HTMLElement) {
    currentPage = page;
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
        elt.addEventListener("mousedown", startDrag);
    });
    const checkButtons = Array.from(
        page.getElementsByClassName("check-button")
    );
    const tryAgainButtons = Array.from(
        page.getElementsByClassName("try-again-button")
    );
    const showCorrectButtons = Array.from(
        page.getElementsByClassName("show-correct-button")
    );

    checkButtons.forEach((elt: HTMLElement) => {
        elt.addEventListener("click", performCheck);
    });
    tryAgainButtons.forEach((elt: HTMLElement) => {
        elt.addEventListener("click", performTryAgain);
    });
    showCorrectButtons.forEach((elt: HTMLElement) => {
        elt.addEventListener("click", showCorrect);
    });
}

// Cleans up whatever prepareACtivity() did, especially when switching to another tab.
// May also be useful to do when switching pages in player. If not, we may want to move
// this out of this runtime file; but it's nice to keep it with prepareActivity.
export function undoPrepareActivity(page: HTMLElement) {
    page.querySelectorAll("[data-bubble-id]").forEach((elt: HTMLElement) => {
        elt.removeEventListener("mousedown", startDrag);
    });
    const checkButtons = Array.from(
        page.getElementsByClassName("check-button")
    );
    const tryAgainButtons = Array.from(
        page.getElementsByClassName("try-again-button")
    );
    const showCorrectButtons = Array.from(
        page.getElementsByClassName("show-correct-button")
    );

    checkButtons.concat(tryAgainButtons).forEach((elt: HTMLElement) => {
        elt.removeEventListener("click", performCheck);
    });
    showCorrectButtons.forEach((elt: HTMLElement) => {
        elt.removeEventListener("click", showCorrect);
    });
}

const showCorrect = (e: MouseEvent) => {
    currentPage
        ?.querySelectorAll("[data-bubble-id]")
        .forEach((elt: HTMLElement) => {
            const targetId = elt.getAttribute("data-bubble-id");
            const target = currentPage?.querySelector(
                `[data-target-of="${targetId}"]`
            ) as HTMLElement;
            if (!target) {
                return;
            }
            const x = target.offsetLeft;
            const y = target.offsetTop;
            elt.style.left = x + "px";
            elt.style.top = y + "px";
        });
};

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
        const oldPosition = originalPositions.get(dragTarget);
        dragTarget.style.top = oldPosition?.y + "px";
        dragTarget.style.left = oldPosition?.x + "px";
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

    classSetter(page, "drag-activity-correct", allCorrect);
    classSetter(page, "drag-activity-wrong", !allCorrect);

    // play sound
    const soundFile = page.getAttribute(
        allCorrect ? "data-correct-sound" : "data-wrong-sound"
    );
    if (soundFile) {
        const audio = new Audio("audio/" + soundFile);
        audio.style.visibility = "hidden";
        // To my surprise, in BP storybook it works without adding the audio to any document.
        // But in Bloom proper, it does not. I think it is because this code is part of the toolbox,
        // so the audio element doesn't have the right context to interpret the relative URL.
        page.append(audio);
        // It feels cleaner if we remove it when done. This could fail, e.g., if the user
        // switches tabs or pages before we get done playing. Removing it immediately
        // prevents the sound being played. It's not a big deal if it doesn't get removed.
        audio.play();
        audio.addEventListener("ended", () => page.removeChild(audio));
    }

    return allCorrect;
};

export const performTryAgain = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const page = target.closest(".bloom-page") as HTMLElement;
    classSetter(page, "drag-activity-correct", false);
    classSetter(page, "drag-activity-wrong", false);
};

export const classSetter = (
    page: HTMLElement,
    className: string,
    wanted: boolean
) => {
    if (wanted) {
        page.parentElement?.classList.add(className);
    } else {
        page.parentElement?.classList.remove(className);
    }
};
