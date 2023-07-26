/** @jsx jsx **/
import { jsx, css } from "@emotion/react";

import * as React from "react";
import { OverlayTool } from "./overlayTool";
import { Div, Span } from "../../../react_components/l10nComponents";
import { kBloomGray } from "../../../utils/colorUtils";
import { setupDraggingTargets } from "../dragActivity/dragActivityTool";
import { BubbleManager } from "../../js/bubbleManager";

const ondragstart = (ev: React.DragEvent<HTMLElement>, style: string) => {
    // Here "text/x-bloombubble" is a unique, private data type recognised
    // by ondragover and ondragdrop methods that BubbleManager
    // attaches to bloom image containers. It doesn't make sense to
    // drag these objects anywhere else, so they don't need any of
    // the common data types. Using a private type means that other drop handlers
    // will not accept them. It is often recommended to include a text/plain value,
    // but it really doesn't make sense to drop the text associated with these
    // bubbles anywhere outside Bloom. I believe the text/x- prefix makes these
    // valid (unregistered) mime types, which technically this argument is supposed
    // to be.
    ev.dataTransfer.setData("text/x-bloombubble", style);
};

function getDimension(dist: string): number {
    const num = dist.substring(0, dist.length - 2); // strip off "px"
    return parseFloat(num);
}

const ondragend = (
    ev: React.DragEvent<HTMLElement>,
    style: string,
    draggable: boolean
) => {
    const bubbleManager = OverlayTool.bubbleManager();
    // The Linux/Mono/Geckofx environment does not produce the dragenter, dragover,
    // and drop events for the targeted element.  It does produce the dragend event
    // for the source element with screen coordinates of where the mouse was released.
    // This can be used to simulate the drop event with coordinate transformation.
    // See https://issues.bloomlibrary.org/youtrack/issue/BL-7958.
    if (bubbleManager) {
        const bubble = bubbleManager.addOverPictureElementWithScreenCoords(
            ev.screenX,
            ev.screenY,
            style
        );
        if (bubble && draggable) {
            //setTimeout(() => {
            let id = Math.random()
                .toString(36)
                .substring(2, 9);
            while (document.querySelector(`[data-bubble-id="${id}"]`)) {
                id = Math.random()
                    .toString(36)
                    .substring(2, 9);
            }
            bubble.setAttribute("data-bubble-id", id);
            // don't simplify to 'document.createElement'; may be in a different iframe
            const target = bubble.ownerDocument.createElement("div");
            target.setAttribute("data-target-of", id);
            const left = getDimension(bubble.style.left);
            const top = getDimension(bubble.style.top);
            const width = getDimension(bubble.style.width);
            const height = getDimension(bubble.style.height);
            const newLeft = left + 20;
            const newTop = top + height + 30;
            // Todo: if this puts it outside the parent of bubble, move it somewhere else
            target.style.left = `${newLeft}px`;
            target.style.top = `${newTop}px`;
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            bubble.parentElement!.appendChild(target);
            setupDraggingTargets(target);
            // }, 1000);
        }
    }
};

export const OverlayImageItem: React.FunctionComponent<{
    src: string;
    style: string;
    draggable?: boolean;
}> = props => {
    return (
        <img
            css={css`
                width: 50px;
                height: 50px;
                cursor: grab;
            `}
            src={props.src}
            draggable={true}
            onDragStart={ev => ondragstart(ev, props.style)}
            onDragEnd={ev =>
                ondragend(ev, props.style, props.draggable ?? false)
            }
        />
    );
};

export const OverlayTextItem: React.FunctionComponent<{
    l10nKey: string;
    style: string;
    className?: string;
    draggable?: boolean;
}> = props => {
    return (
        <Span
            l10nKey={props.l10nKey}
            className={props.className}
            draggable={true}
            onDragStart={ev => ondragstart(ev, props.style)}
            onDragEnd={ev =>
                ondragend(ev, props.style, props.draggable ?? false)
            }
        ></Span>
    );
};

export const OverlayItemRow: React.FunctionComponent<{
    children: React.ReactNode;
    secondRow?: boolean;
}> = props => {
    return (
        <div
            css={css`
                // Using display: flex helps us grow some of the children
                // while also allowing us to adapt to the presence or absence of the vertical scrollbar
                display: flex;

                // Each row fills the entire width of the parent horizontally
                width: 100%;
                height: 50px;
                align-items: center; // vertical
                justify-content: space-between; // horizontal
                margin-right: 4px; // matches the space on the left

                // Each row gets a little vertical cushion
                margin-top: 10px;
                ${props.secondRow ? "margn-top: 0; margin-bottom: 10px;" : ""}
            `}
        >
            {props.children}
        </div>
    );
};

export const OverlayItemRegion: React.FunctionComponent<{
    children: React.ReactNode;
    className?: string;
}> = props => {
    return (
        <div
            css={css`
                background-color: ${kBloomGray};
                padding: 6px;
                display: flex;
                flex-wrap: wrap;
            `}
            className={props.className}
        >
            <Div
                l10nKey="EditTab.Toolbox.ComicTool.DragInstructions"
                className="overlayToolControlDragInstructions"
            >
                Drag any of these overlays onto the image:
            </Div>
            {props.children}
        </div>
    );
};
