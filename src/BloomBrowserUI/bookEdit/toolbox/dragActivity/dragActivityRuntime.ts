// This is the code that is shared between the test tab of the toolbox and bloom-player.

import { get } from "jquery";
import {
    kAudioSentence,
    playAllAudio,
    playAllVideo,
    urlPrefix
} from "./dragActivityNarration";

let slots: { x: number; y: number }[] = [];
let originalPositions = new Map<HTMLElement, { x: number; y: number }>();
let currentPage: HTMLElement | undefined;
let changePageAction: (next: boolean) => void | undefined;
export function prepareActivity(
    page: HTMLElement,
    cpa: (next: boolean) => void
) {
    currentPage = page;
    changePageAction = cpa;
    const changePageButtons = Array.from(
        page.getElementsByClassName("bloom-change-page-button")
    );
    changePageButtons.forEach(b =>
        b.addEventListener("click", changePageButtonClicked)
    );

    slots = [];
    originalPositions = new Map<HTMLElement, { x: number; y: number }>();
    page.querySelectorAll("[data-bubble-id]").forEach((elt: HTMLElement) => {
        const targetId = elt.getAttribute("data-bubble-id");
        const target = page.querySelector(
            `[data-target-of="${targetId}"]`
        ) as HTMLElement;
        if (target) {
            const x = target.offsetLeft;
            const y = target.offsetTop;
            slots.push({ x, y });
        }
        // if it has data-bubble-id, it should be draggable, just not needed
        // for the right answer.
        originalPositions.set(elt, { x: elt.offsetLeft, y: elt.offsetTop });
        elt.addEventListener("pointerdown", startDrag, { capture: true });
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

    // random word order in sentence
    Array.from(page.getElementsByClassName("drag-item-order-sentence")).forEach(
        (elt: HTMLElement) => {
            const contentElt = elt.getElementsByClassName("bloom-content1")[0];
            const content = contentElt?.textContent?.trim();
            if (!content) return;
            const userStyle =
                Array.from(contentElt.classList).find(c =>
                    c.endsWith("-style")
                ) ?? "Normal-style";
            const words = content.split(" ");
            const shuffledWords = shuffle(words);
            const container = page.ownerDocument.createElement("div");
            container.classList.add("drag-item-random-sentence");
            container.setAttribute("data-answer", content);
            makeWordItems(page, shuffledWords, container, userStyle, true);
            container.style.left = elt.style.left;
            container.style.top = elt.style.top;
            container.style.width =
                elt.parentElement!.offsetWidth - elt.offsetLeft - 10 + "px";
            // Enhance: limit width somehow so it does not collide with other elements?
            elt.parentElement?.insertBefore(container, elt);
        }
    );

    // for word-chooser-slider
    setupWordChooserSlider(page);
    setSlideablesVisibility(page, false);
    showARandomWord(page);
    setupSliderImageEvents(page);
    playInitialElements(page);
}

function makeWordItems(
    page: HTMLElement,
    words: string[],
    container: HTMLElement,
    userStyle: string,
    makeDraggable: boolean
) {
    words.forEach(word => {
        const wordItem = page.ownerDocument.createElement("div");
        wordItem.classList.add("drag-item-order-word");
        wordItem.textContent = word;
        container.appendChild(wordItem);
        wordItem.classList.add(userStyle);
        if (makeDraggable) {
            wordItem.addEventListener("pointerdown", startDragReposition);
        }
    });
}

function changePageButtonClicked(e: MouseEvent) {
    const next = (e.currentTarget as HTMLElement).classList.contains(
        "bloom-next-page"
    );
    changePageAction?.(next);
}

function playInitialElements(page: HTMLElement) {
    const initialFilter = e => {
        const top = e.closest(".bloom-textOverPicture") as HTMLElement;
        if (!top) {
            return false; // don't expect any non-TOP in a drag-activity, but just in case
        }
        if (top.classList.contains("draggable-text")) {
            return false; // drraggable items are played only when clicked
        }
        if (top.classList.contains("drag-item-order-sentence")) {
            return false; // This would give away the answer
        }
        if (top.classList.contains("bloom-wordChoice")) {
            return false; // Only one of these should be played, after any instructions
        }
        // This might be redundant since they are not visible, but just in case
        if (
            top.classList.contains("drag-item-correct") ||
            top.classList.contains("drag-item-wrong")
        ) {
            return false; // These are only played after they become visible
        }
        return true;
    };
    const videoElements = Array.from(page.getElementsByTagName("video")).filter(
        initialFilter
    );
    const audioElements = getPlayableDivs(page).filter(initialFilter);
    const activeTextBox = page.getElementsByClassName(
        "bloom-activeTextBox"
    )[0] as HTMLElement;
    if (activeTextBox) {
        audioElements.push(activeTextBox);
    }
    const playables = getAudioSentences(audioElements);
    playAllVideo(videoElements, () => playAllAudio(playables));
}

function getAudioSentences(editables: HTMLElement[]) {
    // Could be done more cleanly with flatMap or flat() but not ready to switch to es2019 yet.
    const result: HTMLElement[] = [];
    editables.forEach(e => {
        if (e.classList.contains(kAudioSentence)) {
            result.push(e);
        }
        result.push(
            ...(Array.from(
                e.getElementsByClassName(kAudioSentence)
            ) as HTMLElement[])
        );
    });
    return result;
}

function getPlayableDivs(container: HTMLElement) {
    // We want to play any audio we have from divs the user can see.
    // This is a crude test, but currently we always use display:none to hide unwanted languages.
    return Array.from(
        container.getElementsByClassName("bloom-editable")
    ).filter(
        e => window.getComputedStyle(e).display !== "none"
    ) as HTMLElement[];
}

function shuffle<T>(array: T[]): T[] {
    // review: something Copliot came up with. Is it guaranteed to be sufficiently different
    // from the correct answer?
    let currentIndex = array.length,
        randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex]
        ];
    }
    return array;
}

// Cleans up whatever prepareACtivity() did, especially when switching to another tab.
// May also be useful to do when switching pages in player. If not, we may want to move
// this out of this runtime file; but it's nice to keep it with prepareActivity.
export function undoPrepareActivity(page: HTMLElement) {
    const changePageButtons = Array.from(
        page.getElementsByClassName("bloom-change-page-button")
    );
    changePageButtons.forEach(b =>
        b.removeEventListener("click", changePageButtonClicked)
    );

    page.querySelectorAll("[data-bubble-id]").forEach((elt: HTMLElement) => {
        elt.removeEventListener("pointerdown", startDrag);
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

    Array.from(
        page.getElementsByClassName("drag-item-random-sentence")
    ).forEach((elt: HTMLElement) => {
        elt.parentElement?.removeChild(elt);
    });
    setSlideablesVisibility(page, true);
    Array.from(page.getElementsByTagName("img")).forEach((img: HTMLElement) => {
        img.removeEventListener("click", clickSliderImage);
    });
}

const showCorrect = (e: MouseEvent) => {
    if (!currentPage) {
        return; // huh?? but makes TS happy
    }
    currentPage
        .querySelectorAll("[data-bubble-id]")
        .forEach((elt: HTMLElement) => {
            const targetId = elt.getAttribute("data-bubble-id");
            const target = currentPage?.querySelector(
                `[data-target-of="${targetId}"]`
            ) as HTMLElement;
            if (!target) {
                return; // this one is not required to be in a right place
            }
            const x = target.offsetLeft;
            const y = target.offsetTop;
            elt.style.left = x + "px";
            elt.style.top = y + "px";
        });
    Array.from(
        currentPage.getElementsByClassName("drag-item-random-sentence")
    ).forEach((container: HTMLElement) => {
        const correctAnswer =
            container.getAttribute("data-answer")?.split(" ") ?? [];
        const classes = container.children[0]?.classList;
        let userStyle = "Normal-style";
        if (classes) {
            userStyle =
                Array.from(classes).find(c => c.endsWith("-style")) ??
                "Normal-style";
        }
        container.innerHTML = "";
        makeWordItems(currentPage!, correctAnswer, container, userStyle, false);
    });
    classSetter(currentPage!, "drag-activity-wrong", false);
    classSetter(currentPage!, "drag-activity-solution", true);
};

let dragStartX = 0;
let dragStartY = 0;
let dragTarget: HTMLElement;
let snapped = false;
let originalLeft = "";
let originalTop = "";

const startDrag = (e: PointerEvent) => {
    if (e.button !== 0) return; // only left button
    if (e.ctrlKey) return; // ignore ctrl+click
    // get the mouse cursor position at startup:
    e.preventDefault(); // e.g., don't do default drag of child image
    const target = e.currentTarget as HTMLElement;
    dragTarget = target;
    const page = target.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    originalLeft = target.style.left;
    originalTop = target.style.top;
    dragStartX = e.clientX / scale - target.offsetLeft;
    dragStartY = e.clientY / scale - target.offsetTop;
    target.setPointerCapture(e.pointerId);
    target.addEventListener("pointerup", stopDrag);
    // call a function whenever the cursor moves:
    target.addEventListener("pointermove", elementDrag);
    const possibleElements = getPlayableDivs(target);
    const playables = getAudioSentences(possibleElements);
    playAllAudio(playables);
};

const elementDrag = (e: PointerEvent) => {
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
const stopDrag = (e: PointerEvent) => {
    const page = dragTarget.closest(".bloom-page") as HTMLElement;
    if (!snapped) {
        const oldPosition = originalPositions.get(dragTarget);
        dragTarget.style.top = oldPosition?.y + "px";
        dragTarget.style.left = oldPosition?.x + "px";
    }
    dragTarget.removeEventListener("pointerup", stopDrag);
    dragTarget.removeEventListener("pointermove", elementDrag);

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
    const allCorrect = checkDraggables(page) && checkRandomSentences(page);

    showCorrectOrWrongItems(page, allCorrect);

    return allCorrect;
};

export const performTryAgain = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const page = target.closest(".bloom-page") as HTMLElement;
    classSetter(page, "drag-activity-correct", false);
    classSetter(page, "drag-activity-wrong", false);
    //currently I don't think it could be set here, but make sure.
    classSetter(page, "drag-activity-solution", false);
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

let draggableReposition: HTMLElement;
let itemBeingRepositioned: HTMLElement;
function showCorrectOrWrongItems(page: HTMLElement, allCorrect: boolean) {
    classSetter(page, "drag-activity-correct", allCorrect);
    classSetter(page, "drag-activity-wrong", !allCorrect);

    // play sound
    const soundFile = page.getAttribute(
        allCorrect ? "data-correct-sound" : "data-wrong-sound"
    );
    const playOtherStuff = () => {
        const elementsMadeVisible = Array.from(
            page.getElementsByClassName(
                allCorrect ? "drag-item-correct" : "drag-item-wrong"
            )
        ) as HTMLElement[];
        const possibleElements: HTMLElement[] = [];
        const videoElements: HTMLVideoElement[] = [];
        elementsMadeVisible.forEach(e => {
            possibleElements.push(...getPlayableDivs(e));
            videoElements.push(...Array.from(e.getElementsByTagName("video")));
        });
        const playables = getAudioSentences(possibleElements);
        playAllVideo(videoElements, () => playAllAudio(playables));
    };
    if (soundFile) {
        const audio = new Audio(urlPrefix() + "/audio/" + soundFile);
        audio.style.visibility = "hidden";
        // To my surprise, in BP storybook it works without adding the audio to any document.
        // But in Bloom proper, it does not. I think it is because this code is part of the toolbox,
        // so the audio element doesn't have the right context to interpret the relative URL.
        page.append(audio);
        // It feels cleaner if we remove it when done. This could fail, e.g., if the user
        // switches tabs or pages before we get done playing. Removing it immediately
        // prevents the sound being played. It's not a big deal if it doesn't get removed.
        audio.play();
        audio.addEventListener(
            "ended",
            () => {
                page.removeChild(audio);
                playOtherStuff();
            },
            { once: true }
        );
    } else {
        playOtherStuff();
    }
}

function checkDraggables(page: HTMLElement) {
    let allCorrect = true;
    const bubbles = Array.from(page.querySelectorAll("[data-bubble-id]"));
    bubbles.forEach((elt: HTMLElement) => {
        const targetId = elt.getAttribute("data-bubble-id");
        const target = page.querySelector(
            `[data-target-of="${targetId}"]`
        ) as HTMLElement;
        if (!target) {
            // this one is not required to be in a right place.
            // Possibly we might one day need to check that it has NOT been dragged to a target.
            // But for now, we only allow ond draggable per target, so if this has been wrongly
            // used some other one will not be in the right place.
            return;
        }

        const correctX = target.offsetLeft;
        const correctY = target.offsetTop;

        if (!rightPosition(elt, correctX, correctY)) {
            // It's not in the expected place. But perhaps one with the same text is?
            // This only applies if it's a text item.
            // (don't use getElementsByClassName here...there could be a TG on an image description of
            // a picture. To be a text item it must have a direct child that is a TG.)
            if (
                !Array.from(elt.children).some(x =>
                    x.classList.contains("bloom-translationGroup")
                )
            ) {
                // not a text item. Two images or videos with the same (empty) text are not equivalent.
                allCorrect = false;
                return;
            }
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
    return allCorrect;
}

let placeHolder: HTMLElement | undefined;
let startWidth = 0;
const draggableWordMargin = 5; // enhance: compute from element

function startDragReposition(e: PointerEvent) {
    if (e.button !== 0) return; // only left button
    if (e.ctrlKey) return; // ignore ctrl+click
    // get the pointer position at startup:
    const target = e.currentTarget as HTMLElement;
    itemBeingRepositioned = target;
    startWidth = target.offsetWidth; // includes original padding but not margin
    const page = target.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    dragStartX = e.clientX / scale - target.offsetLeft;
    dragStartY = e.clientY / scale - target.offsetTop;
    // Leave the original where it was and make a copy to drag around.
    draggableReposition = target.ownerDocument.createElement("div");
    target.classList.forEach(c => draggableReposition.classList.add(c));
    //draggableReposition.classList.add("drag-item-order-word");
    draggableReposition.textContent = target.textContent;
    draggableReposition.style.position = "absolute";
    draggableReposition.style.left = target.offsetLeft + "px";
    draggableReposition.style.top = target.offsetTop + "px";
    // We don't want it to show while we're dragging the clone. We need something to take up the space,
    // though, until we decide it has moved. We could mess with its own properties, but then we have
    // to put everythin back. Also, we want to move it in the paragraph, and if we move the thing
    // itself, we seem to lose our mouse capture. So we make a placeholder to take up the space.
    placeHolder = makeAnimationPlaceholder(target);
    // don't add padding here, target still has it. Capture this before we hide it.
    placeHolder.style.width = startWidth + draggableWordMargin + "px";
    target.parentElement?.insertBefore(placeHolder, target);
    target.style.display = "none";

    // It's bizarre to put the listeners and pointer capture on the target, which is NOT being dragged,
    // rather than the draggableReposition, which is. But it doesn't work to setPointerCapture on
    // the draggableReposition. I think it's because the draggableReposition is not the object clicked.
    // And once the mouse events are captured by the target, all mouse events go to that, so we get
    // them properly while dragging, and can use them to move the draggableReposition.
    target.setPointerCapture(e.pointerId);
    target.addEventListener("pointerup", stopDragReposition);
    // call a function whenever the cursor moves:
    target.addEventListener("pointermove", elementDragReposition);
    // not sure we need this.
    // recommended by https://www.redblobgames.com/making-of/draggable/ to prevent touch movement
    // dragging the page behind the draggable element.
    target.addEventListener("touchstart", preventTouchDefault);
    target.parentElement?.appendChild(draggableReposition);
}

const preventTouchDefault = (e: TouchEvent) => {
    e.preventDefault();
};

let lastItemDraggedOver: HTMLElement | undefined;

const elementDragReposition = (e: PointerEvent) => {
    const page = draggableReposition.closest(".bloom-page") as HTMLElement;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    e.preventDefault();
    const x = e.clientX / scale - dragStartX;
    const y = e.clientY / scale - dragStartY;
    //let deltaMin = Number.MAX_VALUE;

    // Do we want/need any kind of snapping?
    // for (const slot of slots) {
    //     const deltaX = slot.x - x;
    //     const deltaY = slot.y - y;
    //     const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
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
    draggableReposition.style.top = y + "px";
    draggableReposition.style.left = x + "px";

    // move things immediately
    if (animationInProgress) {
        return;
    }
    const container = itemBeingRepositioned.parentElement!;
    const itemDraggedOver = Array.from(container.children).find(c => {
        const rect = c.getBoundingClientRect();
        return (
            c !== itemBeingRepositioned &&
            c !== placeHolder &&
            c !== draggableReposition &&
            e.clientX > rect.left &&
            e.clientX < rect.right &&
            e.clientY > rect.top &&
            e.clientY < rect.bottom
        );
    });

    // If we don't check for a different item, then when we drag a short word over a long one, the mouse
    // may still be over the long word when the animation finishes, at which point it unhelpfully moves
    // back.
    if (itemDraggedOver && itemDraggedOver !== lastItemDraggedOver) {
        const children = Array.from(container.children);
        if (
            children.indexOf(itemDraggedOver) > children.indexOf(placeHolder!)
        ) {
            // moving right; it wants to go after the thing we dragged onto.
            // (It's OK if nextSibling is null; gets inserted at end, which is what we want.)
            animateMove(() => {
                container.insertBefore(
                    placeHolder!,
                    itemDraggedOver.nextSibling
                );
            });
        } else {
            // moving left; it wants to go before the thing we dragged onto.
            animateMove(() => {
                container.insertBefore(placeHolder!, itemDraggedOver);
            });
        }
    } else {
        // moved outside the sentence altogether. If we're below or to the right of the last item,
        // move to the end. Enhance: should we move to the front if we're above or to the left?
        const relatedItems = Array.from(
            itemBeingRepositioned.parentElement!.getElementsByClassName(
                "drag-item-order-word"
            )
        ).filter(
            x =>
                x !== itemBeingRepositioned &&
                x !== placeHolder &&
                x !== draggableReposition
        ) as HTMLElement[];
        const lastItem = relatedItems[relatedItems.length - 1];
        const bounds = lastItem.getBoundingClientRect();
        if (
            e.clientY > bounds.bottom ||
            (e.clientX > bounds.right && e.clientY > bounds.top)
        ) {
            animateMove(() => {
                container.appendChild(placeHolder!);
            });
        }
    }
    lastItemDraggedOver = itemDraggedOver as HTMLElement;
};

const stopDragReposition = (e: PointerEvent) => {
    const page = draggableReposition.closest(".bloom-page") as HTMLElement;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    itemBeingRepositioned.style.visibility = "visible";
    itemBeingRepositioned.removeEventListener("pointerup", stopDragReposition);
    itemBeingRepositioned.removeEventListener(
        "pointermove",
        elementDragReposition
    );
    itemBeingRepositioned.releasePointerCapture(e.pointerId); // redundant I think
    itemBeingRepositioned.removeEventListener(
        "touchstart",
        preventTouchDefault
    );
    // We're getting rid of this, so we don't need to remove the event handlers it has.
    draggableReposition.parentElement?.removeChild(draggableReposition);

    itemBeingRepositioned.style.width = "";
    itemBeingRepositioned.style.paddingLeft = "";
    itemBeingRepositioned.style.paddingRight = "";
    itemBeingRepositioned.style.marginRight = "";
    itemBeingRepositioned.parentElement?.insertBefore(
        itemBeingRepositioned,
        placeHolder!
    );
    itemBeingRepositioned.parentElement?.removeChild(placeHolder!);
    placeHolder = undefined;
    itemBeingRepositioned.style.display = "";

    // const itemDroppedOn = page.ownerDocument
    //     .elementFromPoint(x, y)
    //     ?.closest(".drag-item-order-word");
    // const container = itemBeingRepositioned.parentElement!;
    // if (itemDroppedOn) {
    //     if (
    //         container !== itemDroppedOn.parentElement ||
    //         itemDroppedOn === itemBeingRepositioned ||
    //         !container
    //     ) {
    //         return;
    //     }
    //     container.insertBefore(itemBeingRepositioned, itemDroppedOn)
    // } else {
    //     const relatedItems = Array.from(
    //         itemBeingRepositioned.parentElement!.getElementsByClassName(
    //             "drag-item-order-word"
    //         )
    //     ) as HTMLElement[];
    //     const lastItem = relatedItems[relatedItems.length - 1];
    //     const bounds = lastItem.getBoundingClientRect();
    //     if (y > bounds.bottom || (x > bounds.right && y > bounds.top)) {
    //             container.appendChild(itemBeingRepositioned)
    //     }
    // }
};

function makeAnimationPlaceholder(itemBeingRepositioned: HTMLElement) {
    const placeholder = itemBeingRepositioned.cloneNode(true) as HTMLElement;
    placeholder.style.overflowX = "hidden";
    placeholder.style.marginRight = "0"; // clear all these so it can shrink to taking up no space at all.
    placeholder.style.paddingLeft = "0";
    placeholder.style.paddingRight = "0";
    placeholder.style.display = ""; // in case it was display:none
    placeholder.style.visibility = "hidden"; //just takes up space for animation
    return placeholder;
}

let animationInProgress = false;

function animateMove(movePlaceholder: () => void) {
    animationInProgress = true;
    const duration = 200;
    const container = itemBeingRepositioned.parentElement!;
    const duplicate = makeAnimationPlaceholder(itemBeingRepositioned);
    container.insertBefore(duplicate, placeHolder!);
    movePlaceholder();
    const start = Date.now();

    // without padding or margin. Although we set box-sizing: border-box, we remove padding from
    // the placeholder so that it can shrink to zero width

    const step = () => {
        const elapsed = Date.now() - start;
        const fraction = Math.min(elapsed / duration, 1);
        const originalWordWidth = startWidth + draggableWordMargin;
        if (!placeHolder) {
            // terminated by mouseUp
            container.removeChild(duplicate);
            animationInProgress = false;
            return;
        }
        placeHolder!.style.width = originalWordWidth * fraction + "px";
        // This width includes the original padding and margin, so that it takes up the original space
        // to begin with, but can drop to zero.
        duplicate.style.width = originalWordWidth * (1 - fraction) + "px";
        if (fraction < 1) {
            requestAnimationFrame(step);
        } else {
            // animation is over, clean up.
            container.removeChild(duplicate);
            placeHolder!.style.width = originalWordWidth + "px";
            animationInProgress = false;
        }
    };
    requestAnimationFrame(step);
}
function checkRandomSentences(page: HTMLElement) {
    const sentences = page.getElementsByClassName("drag-item-random-sentence");
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const words = sentence.getAttribute("data-answer")!.split(" ");
        const items = Array.from(sentence.children);
        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (item.textContent !== words[j]) {
                return false;
            }
        }
    }
    return true;
}

export let draggingSlider = false;

// Setup that is common to try-it and design time
export function setupWordChooserSlider(page: HTMLElement) {
    const wrapper = page.getElementsByClassName(
        "bloom-activity-slider"
    )[0] as HTMLElement;
    if (!wrapper) {
        return; // panic?
    }
    wrapper.innerHTML = ""; // clear out any existing content.
    const slider = page.ownerDocument.createElement("div");
    slider.classList.add("bloom-activity-slider-content");
    slider.style.left = 0 + "px";
    wrapper.appendChild(slider);
    dragStartX = 0;
    const scale = page.getBoundingClientRect().width / page.offsetWidth;
    // Review: maybe we should use some sort of fancier slider? This one, for example,
    // won't have fancy effects like continuing to slide if you flick it.
    // But it's also possible this is good enough. Not really expecting a lot more items
    // than will fit.
    const moveHandler = (e: PointerEvent) => {
        let x = e.clientX / scale - dragStartX;
        if (Math.abs(x) > 4) {
            draggingSlider = true;
        }
        if (x > 0) {
            x = 0;
        }
        const maxScroll = Math.max(slider.offsetWidth - wrapper.offsetWidth, 0);
        if (x < -maxScroll) {
            x = -maxScroll;
        }
        slider.style.left = x + "px";
    };
    const upHandler = (e: PointerEvent) => {
        slider.removeEventListener("pointermove", moveHandler);
        page.ownerDocument.body.removeEventListener("pointerup", upHandler);
        setTimeout(() => {
            draggingSlider = false;
        }, 50);
    };
    slider.addEventListener("pointerdown", e => {
        if (e.button !== 0) return; // only left button
        if (e.ctrlKey) return; // ignore ctrl+click
        dragStartX = e.clientX / scale - slider.offsetLeft;
        slider.addEventListener("pointermove", moveHandler);
        // We'd like to capture the pointer, and then we could put the up handler on the slider.
        // But then a click on an image inside the slider never gets the mouse up event, so never
        // gets a click. So we put the up handler on the body (so that it will get called even if
        // the up happens outside the slider).
        //slider.setPointerCapture(e.pointerId);
        page.ownerDocument.body.addEventListener("pointerup", upHandler);
    });

    const imagesToPlace = shuffle(
        Array.from(page.querySelectorAll("[data-img-txt]"))
    );
    imagesToPlace.forEach((imgTop: HTMLElement) => {
        const img = imgTop.getElementsByTagName("img")[0];
        let sliderImgSrc = "";
        if (img) {
            // An older comment said:
            // Not just img.src: that yields a full URL, which will show the image, but will not match
            // when we are later trying to find the corresponding original image.
            // I'm not finding anything that works that way, and the code below finds a full URL
            sliderImgSrc = img.getAttribute("src")!;
        } else {
            // In bloom-player, for a forgotten and possibly obsolete reason, we use a background image
            // on the container. (I vaguely recall it may be important when animating the main image.)
            const imgContainer = imgTop.getElementsByClassName(
                "bloom-imageContainer"
            )[0] as HTMLElement;
            if (!imgContainer) {
                return; // weird
            }
            const bgImg = imgContainer.style.backgroundImage;
            if (!bgImg) {
                return; // weird
            }
            const start = bgImg.indexOf('"');
            const end = bgImg.lastIndexOf('"');
            sliderImgSrc = bgImg.substring(start + 1, end);
        }
        // not using cloneNode here because I don't want to bring along any alt text that might provide a clue
        const sliderImg = imgTop.ownerDocument.createElement("img");
        // Not just img.src: that yields a full URL, which will show the image, but will not match
        // when we are later trying to find the corresponding original image.
        sliderImg.src = sliderImgSrc;
        sliderImg.ondragstart = () => false;
        sliderImg.setAttribute(
            "data-img",
            imgTop.getAttribute("data-img-txt")!
        );
        const sliderItem = imgTop.ownerDocument.createElement("div");
        sliderItem.classList.add("bloom-activity-slider-item");
        sliderItem.appendChild(sliderImg);
        slider.appendChild(sliderItem);
    });
    if (slider.offsetWidth > wrapper.offsetWidth) {
        // We need a slider effect. We want one of the images to be partly visible as a clue that
        // sliding is possible.
        const avWidth = slider.offsetWidth / imagesToPlace.length;
        let indexNearBorder = Math.floor(wrapper.offsetWidth / avWidth);
        let sliderItem = slider.children[indexNearBorder] as HTMLElement;
        if (sliderItem.offsetLeft > wrapper.offsetWidth - 30) {
            // The item we initially selected is mostly off the right edge.
            // Stretch things to make the previous item half-off-screen.
            indexNearBorder--;
            sliderItem = slider.children[indexNearBorder] as HTMLElement;
        }
        if (
            sliderItem.offsetLeft + sliderItem.offsetWidth <
            wrapper.offsetWidth + 30
        ) {
            const oldMarginPx =
                sliderItem.ownerDocument.defaultView?.getComputedStyle(
                    sliderItem
                ).marginLeft ?? "22px";
            const oldMargin = parseInt(
                oldMarginPx.substring(0, oldMarginPx.length - 2)
            );
            const desiredLeft =
                wrapper.offsetWidth - sliderItem.offsetWidth / 2;
            const newMargin =
                oldMargin +
                (desiredLeft - sliderItem.offsetLeft) / indexNearBorder / 2;
            Array.from(slider.children).forEach((elt: HTMLElement) => {
                elt.style.marginLeft = newMargin + "px";
                elt.style.marginRight = newMargin + "px";
            });
        }
    }
}

const clickSliderImage = (e: MouseEvent) => {
    if (draggingSlider) {
        return;
    }
    const img = e.currentTarget as HTMLElement;
    const page = img.closest(".bloom-page") as HTMLElement;
    const activeTextBox = page.getElementsByClassName("bloom-activeTextBox")[0];
    if (!activeTextBox) {
        return; // weird
    }
    var activeId = activeTextBox.getAttribute("data-txt-img");
    const imgId = img.getAttribute("data-img");
    if (activeId === imgId) {
        const imgTop = page.querySelector(`[data-img-txt="${imgId}"]`);
        if (!imgTop) {
            return; // weird
        }
        imgTop.classList.remove("bloom-hideSliderImage");
        setTimeout(() => {
            if (!showARandomWord(page)) {
                showCorrectOrWrongItems(page, true);
            }
        }, 1000); // should roughly correspond to the css transition showing the item
    } else {
        showCorrectOrWrongItems(page, false);
    }
};

function setupSliderImageEvents(page: HTMLElement) {
    const slider = page.getElementsByClassName("bloom-activity-slider")[0];
    if (!slider) {
        return; // panic?
    }
    const sliderImages = Array.from(slider.getElementsByTagName("img"));
    sliderImages.forEach((img: HTMLElement) => {
        img.addEventListener("click", clickSliderImage);
    });
}

export function setSlideablesVisibility(page: HTMLElement, visible: boolean) {
    const slideables = Array.from(page.querySelectorAll("[data-img-txt]"));
    slideables.forEach((elt: HTMLElement) => {
        if (visible) {
            elt.classList.remove("bloom-hideSliderImage");
        } else {
            elt.classList.add("bloom-hideSliderImage");
        }
    });
}

function showARandomWord(page: HTMLElement) {
    const possibleWords = Array.from(page.querySelectorAll("[data-txt-img]"));
    const targetWords = possibleWords.filter(w => {
        const imgId = w.getAttribute("data-txt-img");
        const img = page.querySelector(`[data-img-txt="${imgId}"]`);
        return img?.classList.contains("bloom-hideSliderImage");
    });
    possibleWords.forEach(w => {
        w.classList.remove("bloom-activeTextBox");
    });
    if (targetWords.length === 0) {
        return false;
    }

    const randomIndex = Math.floor(Math.random() * targetWords.length);
    targetWords[randomIndex].classList.add("bloom-activeTextBox");
    const playables = getAudioSentences([
        targetWords[randomIndex] as HTMLElement
    ]);
    playAllAudio(playables);
    return true;
}
