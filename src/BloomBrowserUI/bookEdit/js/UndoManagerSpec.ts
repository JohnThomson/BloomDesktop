import {
    applyUndoElement,
    createUndoElement,
    equivalentStates
} from "./undoManager";

describe("UndoManager create/apply Tests", () => {
    it("restores attribute values", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page" style="color: red;" data-rubbish="abc"></div>'
        );
        const state = createUndoElement(page);
        page.style.color = "blue";
        page.removeAttribute("data-rubbish");
        page.setAttribute("data-new", "def");
        applyUndoElement(page, state);

        expect(page.style.color).toEqual("red");
        expect(page.getAttribute("data-rubbish")).toEqual("abc");
        expect(page.hasAttribute("data-new")).toBeFalsy();
        console.log(page.outerHTML);
    });

    it("restores text content", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page">Hello, world!</div>'
        );
        const state = createUndoElement(page);
        page.textContent = "Goodbye, world!";
        applyUndoElement(page, state);
        expect(page.textContent).toEqual("Hello, world!");
    });

    it("removes added children", () => {
        const page = createElementFromHTML('<div class="bloom-page"></div>');
        const state = createUndoElement(page);
        const newDiv = document.createElement("div");
        newDiv.textContent = "Goodbye, world!";
        page.appendChild(newDiv);
        applyUndoElement(page, state);
        expect(page.firstChild).toBeNull();
    });

    it("restores deleted children", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page">hello<b>world</b> out there</div>'
        );
        const state = createUndoElement(page);
        page.innerText = "abc";
        applyUndoElement(page, state);
        const bold = page.getElementsByTagName("b")[0];
        expect(bold.getAttribute("data-undo-id")).not.toBeEmpty();
        bold.removeAttribute("data-undo-id");
        expect(page.innerHTML).toEqual("hello<b>world</b> out there");
    });
    it("removes unwanted text around elements", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page"><div>marker</div><div>mark2</div></div>'
        );
        const state = createUndoElement(page);
        const mark1 = page.firstChild;
        const mark2 = mark1!.nextSibling;
        page.insertBefore(document.createTextNode("unwanted text"), mark1);
        page.insertBefore(document.createTextNode("more text"), mark2);
        page.appendChild(document.createTextNode("end text"));
        applyUndoElement(page, state);
        expect(page.firstChild).toEqual(mark1);
        expect(page.firstChild?.nextSibling).toEqual(mark2);
    });
    it("removes added objcts preserving unchanged objects", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page"><div>marker</div><div>mark2</div><div>mark3</div></div>'
        );
        const state = createUndoElement(page);
        const mark1 = page.firstChild;
        const mark2 = mark1!.nextSibling;
        const mark3 = mark2!.nextSibling;
        page.insertBefore(createElementFromHTML("<b>unwanted bold</b>"), mark1);
        page.insertBefore(
            createElementFromHTML("<i>unwanted italic</i>"),
            mark2
        );
        page.insertBefore(
            createElementFromHTML("<u>unwanted underline</u>"),
            mark3
        );
        applyUndoElement(page, state);
        expect(page.firstChild).toEqual(mark1);
        expect(page.firstChild?.nextSibling).toEqual(mark2);
        expect(page.firstChild?.nextSibling?.nextSibling).toEqual(mark3);
    });
    it("restores a deleted object, preserving unchanged objects and restoring undo ID", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page"><div>marker</div><div>mark2</div><div>mark3</div></div>'
        );
        const state = createUndoElement(page);
        const mark1 = page.firstChild;
        const mark2 = mark1!.nextSibling as HTMLElement;
        const mark3 = mark2!.nextSibling;
        page.insertBefore(createElementFromHTML("<b>unwanted bold</b>"), mark1);
        page.insertBefore(
            createElementFromHTML("<i>unwanted italic</i>"),
            mark2
        );
        page.insertBefore(
            createElementFromHTML("<u>unwanted underline</u>"),
            mark3
        );
        page.removeChild(mark2!);
        applyUndoElement(page, state);
        expect(page.firstChild).toEqual(mark1);
        expect(page.firstChild?.nextSibling?.nextSibling).toEqual(mark3);
        // mark2 was deleted. The code will have to re-create it.
        const newMark2 = page.firstChild?.nextSibling as HTMLElement;
        expect(newMark2).not.toEqual(mark2);
        // Includes checking for the data-undo-id attribute
        expect(
            (page.firstChild?.nextSibling as HTMLElement)?.outerHTML
        ).toEqual(mark2.outerHTML);
    });
    it("handles repeat Undos", () => {
        const page = createElementFromHTML(
            '<div class="bloom-page"><div>marker</div><div>mark2</div><div>mark3</div></div>'
        );
        const state = createUndoElement(page);
        const mark1 = page.firstChild;
        const mark2 = mark1!.nextSibling as HTMLElement;
        const mark3 = mark2!.nextSibling;
        page.insertBefore(createElementFromHTML("<b>unwanted bold</b>"), mark1);
        const state2 = createUndoElement(page);
        page.insertBefore(
            createElementFromHTML("<i>unwanted italic</i>"),
            mark2
        );
        const state3 = createUndoElement(page);
        page.insertBefore(
            createElementFromHTML("<u>unwanted underline</u>"),
            mark3
        );
        page.removeChild(mark2!);
        const state4 = createUndoElement(page);
        applyUndoElement(page, state4);
        applyUndoElement(page, state3);
        applyUndoElement(page, state2);
        applyUndoElement(page, state);
        expect(page.firstChild).toEqual(mark1);
        expect(page.firstChild?.nextSibling?.nextSibling).toEqual(mark3);
        // mark2 was deleted. The code will have to re-create it.
        expect(page.firstChild?.nextSibling).not.toEqual(mark2);
        expect(
            (page.firstChild?.nextSibling as HTMLElement)?.outerHTML
        ).toEqual(mark2.outerHTML);
    });
});

function createElementFromHTML(htmlString) {
    var div = document.createElement("div");
    div.innerHTML = htmlString.trim();

    // Change this to div.childNodes to support multiple top-level nodes.
    return div.firstChild as HTMLElement;
}

// Given some html which creates an element (page) that has a child with id="target" (editable),
// and a function which makes some change to one or both of them (both are passed),
// verify that the states before and after the change are
// - not equivalent, if no ignorable element is specified
// - equivalent, if the target element is specified to be ignored,
// iff the change is entirely inside the target (specified by insideIgnore).
function testEquivalentStates(
    html: string,
    modify: (page: HTMLElement, editable: HTMLElement) => void,
    insideIgnore: boolean
) {
    const page = createElementFromHTML(html);
    const state1 = createUndoElement(page);
    // can't use document.getElementById because we aren't adding page to the document.
    const editable = page.querySelector("[id='target']") as HTMLElement;
    const undoId = editable?.getAttribute("data-undo-id") || "";
    modify(page, editable);
    const state2 = createUndoElement(page);
    expect(equivalentStates(state1, state2, "xyz")).toBe(false);
    expect(equivalentStates(state1, state2, undoId)).toBe(insideIgnore);
}

fdescribe("UndoManager equivalentStates Tests", () => {
    it("considers different text different", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (_page, editable) => {
                editable.innerHTML = "qed";
            },
            true
        );
    });

    it("considers diffs in attributes of child of ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (page, editable) => {
                const bold = editable.getElementsByTagName("b")[0];
                bold.setAttribute("class", "something");
            },
            true
        );
    });
    it("considers an additional child of an ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (_page, editable) => {
                const bold = editable.getElementsByTagName("b")[0];
                const newBold = document.createElement("b");
                newBold.textContent = "new";
                editable.insertBefore(newBold, bold);
            },
            true
        );
    });
    it("considers a missing child of an ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (_page, editable) => {
                const bold = editable.getElementsByTagName("b")[0];
                bold.remove();
            },
            true
        );
    });
    it("considers a changed attribute of an ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (_page, editable) => {
                editable.setAttribute("class", "something");
            },
            false
        );
    });
    it("considers an additional attribute of an ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (_page, editable) => {
                editable.setAttribute("style", "something");
            },
            false
        );
    });
    it("considers an additional sibling after an ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (page, _editable) => {
                page.appendChild(document.createElement("div"));
            },
            false
        );
    });
    it("notices the removal of the ignorable element", () => {
        testEquivalentStates(
            '<div class="bloom-page"><div class="bloom-editable" id="target">abc<b>def</b>hij</div></div>',
            (_page, editable) => {
                editable.remove();
            },
            false
        );
    });

    // todo: change only in tag name
    // additional child (+/-inside igorable, before/after ignorable)
    // missing child (+/-inside igorable, before/after ignorable)
});
