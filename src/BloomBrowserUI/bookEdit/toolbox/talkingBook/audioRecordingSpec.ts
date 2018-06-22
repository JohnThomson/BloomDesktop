import AudioRecording from "./audioRecording";
// Newer audio recording tests. We are trying to avoid using jquery in this set.

function htmlToElement(html: string): HTMLElement {
    var template = document.createElement("template");
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild as HTMLElement;
}

describe("audio recording tests", function () {

    it("moves text from parent to span", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep</span>Text to move</p>");
        var child = p.childNodes[1]; // text node, "Text to move"
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 4);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to keepText");
        expect(p.childNodes[1].textContent).toBe(" to move");
    });

    // Todo: there's a problem case still uncaught here, because when I do the drag for real with this data,
    // I get an extra empty <strong></strong> at the root level between the two sentence spans. Not sure why
    // it happens, not why it does NOT happen with this test.
    it("moves initial strong letter from sentence to sentence", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Here are two sheep. They </span>"
            + "<span class='audio-sentence'><strong>look <em>recently</em></strong> shorn<sentence2.</span></p>");
        var child = p.childNodes[1].childNodes[0].childNodes[0];
        expect(child.textContent).toBe("look "); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Here are two sheep. They l");
        expect(p.childNodes[1].textContent).toBe("ook recently shorn");
        const strong1 = p.childNodes[0].childNodes[1] as Element;
        expect(p.childNodes[0].childNodes.length).toBe(2);  // one text node and ONE strong element
        expect(strong1.textContent).toBe("l");
        expect(strong1.tagName).toBe("STRONG");
    });

    it("moves strong letter from sentence to sentence and consolidates", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Here are two sheep. They <strong>l</strong></span>"
            + "<span class='audio-sentence'><strong>ook <em>recently</em></strong> shorn<sentence2.</span></p>");
        var child = p.childNodes[1].childNodes[0].childNodes[0];
        expect(child.textContent).toBe("ook "); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Here are two sheep. They lo");
        expect(p.childNodes[1].textContent).toBe("ok recently shorn");
        const strong1 = p.childNodes[0].childNodes[1] as Element;
        expect(p.childNodes[0].childNodes.length).toBe(2);  // one text node and ONE strong element
        expect(strong1.textContent).toBe("lo");
        expect(strong1.tagName).toBe("STRONG");
    });

    it("moves text and intermediate sentences and elements from parent to span", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep</span>"
            + "<span class='audio-sentence'>sentence2.</span> <span class='audio-sentence'>sentence 3</span>"
            + "<b>bold</b><i>italic</i>Text to move</p>");
        var child = p.childNodes[6]; // text node, "Text to move"
        expect(child.textContent).toBe("Text to move"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 3);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to keepsentence2. sentence 3bolditalicTex");
        expect(p.childNodes[1].textContent).toBe("t to move");
        expect(p.childNodes[0].childNodes.length).toBe(4); // old text, moved sentence text, bold, italic, new text
        expect((p.childNodes[0].childNodes[1] as Element).tagName).toBe("B");
        expect((p.childNodes[0].childNodes[2] as Element).tagName).toBe("I");
    });

    it("moves text and intermediate sentences and elements from following sentence to span", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep</span>"
            + "<span class='audio-sentence'>sentence2.</span> <span class='audio-sentence'>sentence 3</span>"
            + "<span class=audio-sentence><b>bold</b><i>italic</i>Text to move</span></p>");
        var child = p.childNodes[4].childNodes[2]; // text node, "Text to move" (note the single-space node between sentences)
        expect(child.textContent).toBe("Text to move"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 3);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to keepsentence2. sentence 3bolditalicTex");
        expect(p.childNodes[1].textContent).toBe("t to move");
        expect((p.childNodes[1] as Element).tagName).toBe("SPAN");
        expect((p.childNodes[1] as Element).getAttribute("class")).toBe("audio-sentence");
        expect(p.childNodes[0].childNodes.length).toBe(4); // old text, contents of two following sentences, bold, italic, new text
        expect((p.childNodes[0].childNodes[1] as Element).tagName).toBe("B");
        expect((p.childNodes[0].childNodes[2] as Element).tagName).toBe("I");
    });

    it("moves text from span to parent", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep</span>Text to move</p>");
        var child = p.childNodes[0].childNodes[0]; // text node, "Text to keep"
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 8);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to ");
        expect(p.childNodes[1].textContent).toBe("keepText to move");
    });

    it("moves nested partial text from span to parent and consolidates", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep"
            + "<span style='color:red'>red1<sup>supX<i>i1</i></sup></span></span>"
            + "<span style='color:red'><sup><i>i2</i>sup2</sup>red2</span>Text to leave</p>");
        var child = p.childNodes[0].childNodes[1].childNodes[1].childNodes[0];
        expect(child.textContent).toBe("supX"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 3);
        // We expect the result to be:
        // "<p><span class='audio-sentence ui-audioCurrent'>Text to keep"
        // + "<span style='color:red'>red1<sup>sup</sup></span></span>"
        // + "<span style='color:red'><sup>X<i>i1i2</i>sup2</sup>red2</span>Text to leave</p>"
        expect(p.childNodes.length).toBe(3);
        expect(p.childNodes[0].textContent).toBe("Text to keepred1sup");
        expect(p.childNodes[1].textContent).toBe("Xi1i2sup2red2");
        expect(p.childNodes[2].textContent).toBe("Text to leave");

        const firstRedSpan = p.childNodes[0].childNodes[1] as Element;
        expect(firstRedSpan.tagName).toBe("SPAN");
        expect(firstRedSpan.textContent).toBe("red1sup");
        expect(firstRedSpan.getAttribute("style")).toBe("color:red");
        expect(firstRedSpan.childNodes.length).toBe(2);

        const firstSupSpan = firstRedSpan.childNodes[1] as Element;
        expect(firstSupSpan.tagName).toBe("SUP");
        expect(firstSupSpan.textContent).toBe("sup");
        expect(firstSupSpan.childNodes.length).toBe(1);
        expect((firstSupSpan.childNodes[0] as Element).tagName).toBe(undefined); // text node

        const secondRedSpan = p.childNodes[1] as Element;
        expect(secondRedSpan.tagName).toBe("SPAN");
        expect(secondRedSpan.textContent).toBe("Xi1i2sup2red2");
        expect(secondRedSpan.getAttribute("style")).toBe("color:red");
        expect(secondRedSpan.childNodes.length).toBe(2);

        const secondSupSpan = secondRedSpan.childNodes[0] as Element;
        expect(secondSupSpan.tagName).toBe("SUP");
        expect(secondSupSpan.textContent).toBe("Xi1i2sup2");
        expect(secondSupSpan.childNodes.length).toBe(3);

        const italicSpan = secondSupSpan.childNodes[1] as Element;
        expect(italicSpan.tagName).toBe("I");
        expect(italicSpan.textContent).toBe("i1i2");
        expect(italicSpan.childNodes.length).toBe(1);
        expect((italicSpan.childNodes[0] as Element).tagName).toBe(undefined); // text node
    });

    it("moves text and elements from span to parent", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'><b>bold</b>Text to move"
            + "<u>underline</u> more <sup>superscript</sup> other </span>Text to keep</p>");
        var child = p.childNodes[0].childNodes[1]; // text node, "Text to keep"
        expect(child.textContent).toBe("Text to move"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 8);
        expect(p.childNodes.length).toBe(6);
        expect(p.childNodes[0].textContent).toBe("boldText to ");
        expect((p.childNodes[0].childNodes[0] as Element).tagName).toBe("B");
        expect(p.childNodes[1].textContent).toBe("move");
        expect((p.childNodes[2] as Element).tagName).toBe("U");
        expect(p.childNodes[2].textContent).toBe("underline");
        expect(p.childNodes[3].textContent).toBe(" more ");
        expect((p.childNodes[4] as Element).tagName).toBe("SUP");
        expect(p.childNodes[4].textContent).toBe("superscript");
        expect(p.childNodes[5].textContent).toBe(" other Text to keep");
    });

    it("moves nested partial elements from parent to sentence and consolidates", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u></span>"
            + "<u><i><b>b2 </b>i2 </i>u2</u> Text to keep</p>");
        var child = p.childNodes[1].childNodes[1];
        expect(child.textContent).toBe("u2"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        // We'd like the end result to be
        // <p><span class='audio-sentence ui-audioCurrent'>Text to keep<u>un1 <i>i1 <b>b1 b2 </b>i2 </i>u</u></span>"
        // + "<u>2</u> Text to keep</p>"
        // That is, everything up to the 'u' in 'u2' has moved, and the moved stuff has been
        // consolidated with the similar elements already present.
        expect(p.childNodes.length).toBe(3);
        expect(p.childNodes[0].textContent).toBe("Text to keep un1 i1 b1 b2 i2 u");
        const firstUElt = p.childNodes[0].childNodes[1];
        expect((firstUElt as Element).tagName).toBe("U");
        expect(firstUElt.textContent).toBe("un1 i1 b1 b2 i2 u"); // just one <u>
        expect((firstUElt.childNodes[1] as Element).tagName).toBe("I");
        expect(firstUElt.childNodes[1].textContent).toBe("i1 b1 b2 i2 "); // just one <i>
        expect((firstUElt.childNodes[1].childNodes[1] as Element).tagName).toBe("B");
        expect(firstUElt.childNodes[1].childNodes[1].textContent).toBe("b1 b2 "); // just one <b>

        expect(p.childNodes[1].textContent).toBe("2");
        expect((p.childNodes[1] as Element).tagName).toBe("U");
        expect((p.childNodes[1].childNodes[0] as Element).tagName).toBe(undefined); // that is, it's a simple text node.
        expect(p.childNodes[2].textContent).toBe(" Text to keep");
    });

    // This is deliberately almost the same as the previous test, but in the moved text,
    // the initial characters are not bold. So we can't consolidate as fully.
    it("moves nested partial elements from parent to sentence partial consolidate", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u></span>"
            + "<u><i>i2 i3 </i>u2</u> Text to keep</p>");
        var child = p.childNodes[1].childNodes[1];
        expect(child.textContent).toBe("u2"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        // We'd like the end result to be
        // <p><span class='audio-sentence ui-audioCurrent'>Text to keep<u>un1 <i>i1 <b>b1 </b>i2 i3 </i>u</u></span>"
        // + "<u>2</u> Text to keep</p>"
        // That is, everything up to the 'u' in 'u2' has moved, and the moved stuff has been
        // consolidated with the similar elements already present.
        expect(p.childNodes.length).toBe(3);
        expect(p.childNodes[0].textContent).toBe("Text to keep un1 i1 b1 i2 i3 u");

        const firstUElt = p.childNodes[0].childNodes[1];
        expect((firstUElt as Element).tagName).toBe("U");
        expect(firstUElt.textContent).toBe("un1 i1 b1 i2 i3 u"); // just one <u>
        expect((firstUElt.childNodes[1] as Element).tagName).toBe("I");
        expect(firstUElt.childNodes[1].textContent).toBe("i1 b1 i2 i3 "); // just one <i>
        expect((firstUElt.childNodes[1].childNodes[1] as Element).tagName).toBe("B");
        expect(firstUElt.childNodes[1].childNodes[1].textContent).toBe("b1 "); // just one <b>

        expect(p.childNodes[1].textContent).toBe("2");
        expect((p.childNodes[1] as Element).tagName).toBe("U");
        expect((p.childNodes[1].childNodes[0] as Element).tagName).toBe(undefined); // text node
        expect(p.childNodes[2].textContent).toBe(" Text to keep");
    });

    it("removes sentences entirely transferred to another", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep.</span> "
            + "<span class='audio-sentence'>Text to move.</span></p>");
        var child = p.childNodes[2].childNodes[0];
        expect(child.textContent).toBe("Text to move."); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, child.textContent.length);
        expect(p.childNodes.length).toBe(1);
        expect(p.childNodes[0].textContent).toBe("Text to keep. Text to move.");
    });

    // This time no consolidation is possible
    it("moves nested partial elements from parent to sentence when can't consolidate", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u></span>"
            + "<b><i>i2 </i>b2</b> Text to keep</p>");
        var child = p.childNodes[1].childNodes[1];
        expect(child.textContent).toBe("b2"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        // We'd like the end result to be
        // <p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u><b><i>i2 </i>b</b></span>"
        // + "<b>2</b> Text to keep</p>"
        // That is, everything up to the 'b' in 'b2' has moved into a new element.
        expect(p.childNodes.length).toBe(3);
        expect(p.childNodes[0].textContent).toBe("Text to keep un1 i1 b1 i2 b");

        const firstUElt = p.childNodes[0].childNodes[1];
        expect((firstUElt as Element).tagName).toBe("U");
        expect(firstUElt.textContent).toBe("un1 i1 b1 ");
        expect((firstUElt.childNodes[1] as Element).tagName).toBe("I");
        expect(firstUElt.childNodes[1].textContent).toBe("i1 b1 ");
        expect((firstUElt.childNodes[1].childNodes[1] as Element).tagName).toBe("B");
        expect(firstUElt.childNodes[1].childNodes[1].textContent).toBe("b1 ");

        expect((p.childNodes[0].childNodes[2] as Element).tagName).toBe("B");
        expect(p.childNodes[0].childNodes[2].textContent).toBe("i2 b");
        expect((p.childNodes[0].childNodes[2].childNodes[0] as Element).tagName).toBe("I");
        expect(p.childNodes[0].childNodes[2].childNodes[0].textContent).toBe("i2 ");

        expect(p.childNodes[1].textContent).toBe("2");
        expect((p.childNodes[1] as Element).tagName).toBe("B");
        expect((p.childNodes[1].childNodes[0] as Element).tagName).toBe(undefined); // text node

        expect(p.childNodes[2].textContent).toBe(" Text to keep");
    });

    it("moves nested partial elements from sibling to sentence and consolidates", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u></span>"
            + "<span class='audio-sentence'><u><i><b>b2 </b>i2 </i>u2</u> Text to keep</p></span>");
        var child = p.childNodes[1].childNodes[0].childNodes[1];
        expect(child.textContent).toBe("u2"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        // We'd like the end result to be
        // <p><span class='audio-sentence ui-audioCurrent'>Text to keep<u>un1 <i>i1 <b>b1 b2 </b>i2 </i>u</u></span>"
        // + "<span class='audio-sentence'><u>2</u> Text to keep</p></span>"
        // That is, everything up to the 'u' in 'u2' has moved, and the moved stuff has been
        // consolidated with the similar elements already present.
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to keep un1 i1 b1 b2 i2 u");
        const firstUElt = p.childNodes[0].childNodes[1];
        expect((firstUElt as Element).tagName).toBe("U");
        expect(firstUElt.textContent).toBe("un1 i1 b1 b2 i2 u"); // just one <u>
        expect((firstUElt.childNodes[1] as Element).tagName).toBe("I");
        expect(firstUElt.childNodes[1].textContent).toBe("i1 b1 b2 i2 "); // just one <i>
        expect((firstUElt.childNodes[1].childNodes[1] as Element).tagName).toBe("B");
        expect(firstUElt.childNodes[1].childNodes[1].textContent).toBe("b1 b2 "); // just one <b>

        const parentOfRemnant = p.childNodes[1];
        const remnantU = parentOfRemnant.childNodes[0];
        expect(remnantU.textContent).toBe("2");
        expect((remnantU as Element).tagName).toBe("U");
        expect((remnantU.childNodes[0] as Element).tagName).toBe(undefined); // that is, it's a simple text node.
        expect(parentOfRemnant.childNodes[1].textContent).toBe(" Text to keep");
    });

    // This is deliberately almost the same as the previous test, but in the moved text,
    // the initial characters are not bold. So we can't consolidate as fully.
    it("moves nested partial elements from sibling to sentence partial consolidate", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u></span>"
            + "<span class='audio-sentence'><u><i>i2 i3 </i>u2</u> Text to keep</p></span>");
        var child = p.childNodes[1].childNodes[0].childNodes[1];
        expect(child.textContent).toBe("u2"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        // We'd like the end result to be
        // <p><span class='audio-sentence ui-audioCurrent'>Text to keep<u>un1 <i>i1 <b>b1 </b>i2 i3 </i>u</u></span>"
        // + "<span class='audio-sentence'><u>2</u> Text to keep</p></span>"
        // That is, everything up to the 'u' in 'u2' has moved, and the moved stuff has been
        // consolidated with the similar elements already present.
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to keep un1 i1 b1 i2 i3 u");

        const firstUElt = p.childNodes[0].childNodes[1];
        expect((firstUElt as Element).tagName).toBe("U");
        expect(firstUElt.textContent).toBe("un1 i1 b1 i2 i3 u"); // just one <u>
        expect((firstUElt.childNodes[1] as Element).tagName).toBe("I");
        expect(firstUElt.childNodes[1].textContent).toBe("i1 b1 i2 i3 "); // just one <i>
        expect((firstUElt.childNodes[1].childNodes[1] as Element).tagName).toBe("B");
        expect(firstUElt.childNodes[1].childNodes[1].textContent).toBe("b1 "); // just one <b>

        const parentOfRemnant = p.childNodes[1];
        const remnantU = parentOfRemnant.childNodes[0];
        expect(remnantU.textContent).toBe("2");
        expect((remnantU as Element).tagName).toBe("U");
        expect((remnantU.childNodes[0] as Element).tagName).toBe(undefined); // that is, it's a simple text node.
        expect(parentOfRemnant.childNodes[1].textContent).toBe(" Text to keep");
    });

    // This time no consolidation is possible
    it("moves nested partial elements from sibling to sentence when can't consolidate", function () {
        var p = htmlToElement("<p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u></span>"
            + "<span class='audio-sentence'><b><i>i2 </i>b2</b> Text to keep</p></span>");
        var child = p.childNodes[1].childNodes[0].childNodes[1];
        expect(child.textContent).toBe("b2"); // make sure we got the right child!
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 1);
        // We'd like the end result to be
        // <p><span class='audio-sentence ui-audioCurrent'>Text to keep <u>un1 <i>i1 <b>b1 </b></i></u><b><i>i2 </i>b</b></span>"
        // + "<span class='audio-sentence'><b>2</b> Text to keep</p></span>"
        // That is, everything up to the 'b' in 'b2' has moved into a new element.
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Text to keep un1 i1 b1 i2 b");

        const firstUElt = p.childNodes[0].childNodes[1];
        expect((firstUElt as Element).tagName).toBe("U");
        expect(firstUElt.textContent).toBe("un1 i1 b1 ");
        expect((firstUElt.childNodes[1] as Element).tagName).toBe("I");
        expect(firstUElt.childNodes[1].textContent).toBe("i1 b1 ");
        expect((firstUElt.childNodes[1].childNodes[1] as Element).tagName).toBe("B");
        expect(firstUElt.childNodes[1].childNodes[1].textContent).toBe("b1 ");

        expect((p.childNodes[0].childNodes[2] as Element).tagName).toBe("B");
        expect(p.childNodes[0].childNodes[2].textContent).toBe("i2 b");
        expect((p.childNodes[0].childNodes[2].childNodes[0] as Element).tagName).toBe("I");
        expect(p.childNodes[0].childNodes[2].childNodes[0].textContent).toBe("i2 ");

        const parentOfRemnant = p.childNodes[1];
        const remnantU = parentOfRemnant.childNodes[0];
        expect(remnantU.textContent).toBe("2");
        expect((remnantU as Element).tagName).toBe("B");
        expect((remnantU.childNodes[0] as Element).tagName).toBe(undefined); // that is, it's a simple text node.
        expect(parentOfRemnant.childNodes[1].textContent).toBe(" Text to keep");
    });

    it("does nothing if before selected span", function () {
        var p = htmlToElement("<p><span class='audio-sentence'>Before selection</span>"
            + "<span class='audio-sentence ui-audioCurrent'>Text to keep</span></p>");
        var child = p.childNodes[0].childNodes[0]; // text node, "Before selection"
        AudioRecording.adjustEndOfCurrentAudioSpan(child, 8);
        expect(p.childNodes.length).toBe(2);
        expect(p.childNodes[0].textContent).toBe("Before selection");
        expect(p.childNodes[1].textContent).toBe("Text to keep");
    });
});