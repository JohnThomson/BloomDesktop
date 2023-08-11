/** @jsx jsx **/
import { jsx, css } from "@emotion/react";

import * as React from "react";
import { OverlayTool } from "./overlayTool";
import { Div, Span } from "../../../react_components/l10nComponents";
import { kBloomBlue, kBloomGray } from "../../../utils/colorUtils";
import {
    adjustTarget,
    setupDraggingTargets
} from "../dragActivity/dragActivityTool";
import { BubbleManager } from "../../js/bubbleManager";
import { ImagePlaceholderIcon } from "../../../react_components/icons/ImagePlaceholderIcon";

const ondragstart = (
    ev: React.DragEvent<HTMLElement> | React.DragEvent<SVGSVGElement>,
    style: string
) => {
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
    ev.dataTransfer.setData("text/x-bloomdraggable", "true");
};

function getDimension(dist: string): number {
    const num = dist.substring(0, dist.length - 2); // strip off "px"
    return parseFloat(num);
}

const ondragend = (
    ev: React.DragEvent<HTMLElement> | React.DragEvent<SVGSVGElement>,
    style: string,
    draggable: boolean,
    addClasses?: string
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
        if (bubble && addClasses) {
            bubble.classList.add(...addClasses.split(" "));
        }
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
            bubble.style.width = ev.currentTarget.clientWidth + "px";
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
            // This allows it to get focus, which allows it to get the shadow effect we want when
            // clicked. But is that really right? We can't actually type there.
            target.setAttribute("tabindex", "0");
            bubble.parentElement!.appendChild(target);
            setupDraggingTargets(target);
            adjustTarget(bubble, target);
            // }, 1000);
        }
    }
};

export const OverlayImageItem: React.FunctionComponent<{
    style: string;
    draggable?: boolean;
    addClasses?: string;
    color?: string;
    strokeColor?: string;
}> = props => {
    return (
        <div // infuriatingly, svgs don't support draggable, so we have to wrap.
            css={css`
                width: 50px;
                height: 50px;
                cursor: grab;
            `}
            draggable={true}
            onDragStart={ev => ondragstart(ev, props.style)}
            onDragEnd={ev =>
                ondragend(
                    ev,
                    props.style,
                    props.draggable ?? false,
                    props.addClasses
                )
            }
        >
            <ImagePlaceholderIcon
                css={css`
                    width: 50px;
                    height: 50px;
                    cursor: grab;
                `}
                color={props.color}
                strokeColor={props.strokeColor}
            />
        </div>
    );
};

export const OverlayItem: React.FunctionComponent<{
    src: string;
    style: string;
    draggable?: boolean;
    addClasses?: string;
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
                ondragend(
                    ev,
                    props.style,
                    props.draggable ?? false,
                    props.addClasses
                )
            }
        />
    );
};

export const OverlayTextItem: React.FunctionComponent<{
    l10nKey: string;
    style: string;
    className?: string;
    draggable?: boolean;
    addClasses?: string;
}> = props => {
    return (
        <Span
            l10nKey={props.l10nKey}
            className={props.className}
            draggable={true}
            onDragStart={ev => ondragstart(ev, props.style)}
            onDragEnd={ev =>
                ondragend(
                    ev,
                    props.style,
                    props.draggable ?? false,
                    props.addClasses
                )
            }
        ></Span>
    );
};

const buttonItemProps = css`
    margin-left: 5px;
    text-align: center;
    padding: 2px 0.5em;
    vertical-align: middle;
    color: ${kBloomBlue};
    background-color: "white";
    box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.2);
`;

export const OverlayButtonItem: React.FunctionComponent<{
    l10nKey: string;
    addClasses: string;
}> = props => {
    return (
        <OverlayTextItem
            css={buttonItemProps}
            l10nKey={props.l10nKey}
            addClasses={props.addClasses}
            draggable={false}
            style="none"
        ></OverlayTextItem>
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
                justify-content: space-around; // horizontal
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
    l10nKey?: string;
    theme?: string;
}> = props => {
    const bgColor = props.theme === "blueOnTan" ? "white" : kBloomGray;
    const fgColor = props.theme === "blueOnTan" ? kBloomBlue : "white";
    return (
        <div
            css={css`
                background-color: ${bgColor};
                padding: 6px;
                display: flex;
                flex-wrap: wrap;
            `}
            className={props.className}
        >
            {props.l10nKey === "" || (
                <Div
                    css={css`
                        color: ${fgColor};
                    `}
                    l10nKey={
                        props.l10nKey ??
                        "EditTab.Toolbox.ComicTool.DragInstructions"
                    }
                    className="overlayToolControlDragInstructions"
                >
                    Drag any of these overlays onto the image:
                </Div>
            )}
            {props.children}
        </div>
    );
};
