// This is the code that is shared between the test tab of the toolbox and bloom-player.

let slots: { x: number; y: number }[] = [];
export function prepareActivity(page: HTMLElement) {
    slots = [];
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
        // Todo: these should get cleaned up.
        elt.addEventListener("mousedown", startDrag);
    });
    page.getElementsByClassName("check-button")[0].addEventListener(
        "click",
        performCheck
    );
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
};

export const performCheck = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const page = target.closest(".bloom-page") as HTMLElement;
    let allCorrect = true;
    page.querySelectorAll("[data-bubble-id]").forEach((elt: HTMLElement) => {
        const targetId = elt.getAttribute("data-bubble-id");
        const target = page.querySelector(
            `[data-target-of="${targetId}"]`
        ) as HTMLElement;
        if (!target) {
            return;
        }

        const correctX = target.offsetLeft;
        const correctY = target.offsetTop;
        const actualX = elt.offsetLeft;
        const actualY = elt.offsetTop;
        if (
            // Since anything correct should be snapped, bloom probably isn't necessary
            Math.abs(correctX - actualX) > 0.5 ||
            Math.abs(correctY - actualY) > 0.5
        ) {
            allCorrect = false;
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
