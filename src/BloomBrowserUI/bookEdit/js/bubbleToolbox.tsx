import { jsx, css } from "@emotion/react";

import * as React from "react";
import { useState, useEffect, useMemo, Fragment } from "react";
import * as ReactDOM from "react-dom";
import { kBloomBlue } from "../../bloomMaterialUITheme";
import { default as CopyrightIcon } from "@mui/icons-material/Copyright";
import { default as SearchIcon } from "@mui/icons-material/Search";
import { default as TrashIcon } from "@mui/icons-material/Delete";
import { default as MenuIcon } from "@mui/icons-material/MoreHorizSharp";
import { showCopyrightAndLicenseDialog } from "../editViewFrame";
import { doImageCommand, getImageUrlFromImageContainer } from "./bloomImages";
import { makeDuplicateOfDragBubble } from "../toolbox/dragActivity/dragActivityTool";
import { deleteBubble } from "../toolbox/overlay/overlayTool";

const controlFrameColor: string = kBloomBlue;

const BubbleToolbox: React.FunctionComponent<{
    bubble: HTMLElement;
}> = props => {
    const imgContainer = props.bubble.getElementsByClassName(
        "bloom-imageContainer"
    )[0];
    const hasImage = !!imgContainer;
    const img = imgContainer?.getElementsByTagName("img")[0];
    const hasLicenseProblem = hasImage && !img.getAttribute("data-copyright");
    const isPlaceHolder =
        hasImage && img.getAttribute("src")?.startsWith("placeHolder.png");
    const materialIconCss = css`
        width: 30px;
        border-color: transparent;
        background-color: transparent;
        // These tweaks help make a neat row of aligned buttons the same size.
        top: 3px;
        position: relative;
        svg {
            font-size: 1.7rem;
        }
    `;
    const svgIconCss = css`
        width: 22px;
        border-color: transparent;
        background-color: transparent;
    `;

    return (
        <div
            css={css`
                background-color: white;
                border: 4px solid #eee;
                border-radius: 4px;
                display: flex;
                justify-content: space-around;
                padding: 2px 10px;
                margin: 0 auto 0 auto;
                width: fit-content;
                pointer-events: all;
            `}
        >
            {hasImage && (
                <Fragment>
                    {isPlaceHolder || (
                        <button
                            css={
                                hasLicenseProblem ? svgIconCss : materialIconCss
                            }
                            onClick={() => {
                                if (!props.bubble) return;
                                const imgContainer = props.bubble.getElementsByClassName(
                                    "bloom-imageContainer"
                                )[0] as HTMLElement;
                                if (!imgContainer) return;
                                showCopyrightAndLicenseDialog(
                                    getImageUrlFromImageContainer(imgContainer)
                                );
                            }}
                        >
                            {hasLicenseProblem ? (
                                <img src="/bloom/bookEdit/img/Missing Metadata.svg" />
                            ) : (
                                <CopyrightIcon color="primary" />
                            )}
                        </button>
                    )}
                    <button
                        css={materialIconCss}
                        onClick={e => {
                            if (!props.bubble) return;
                            const imgContainer = props.bubble.getElementsByClassName(
                                "bloom-imageContainer"
                            )[0] as HTMLElement;
                            if (!imgContainer) return;
                            doImageCommand(
                                imgContainer.getElementsByTagName(
                                    "img"
                                )[0] as HTMLImageElement,
                                "change"
                            );
                        }}
                    >
                        <SearchIcon color="primary" />
                    </button>
                </Fragment>
            )}
            <button
                css={svgIconCss}
                onClick={() => {
                    if (!props.bubble) return;
                    const imgContainer = props.bubble.getElementsByClassName(
                        "bloom-imageContainer"
                    )[0] as HTMLElement;
                    if (!imgContainer) return;
                    makeDuplicateOfDragBubble();
                }}
            >
                <img src="/bloom/bookEdit/img/Duplicate.svg" />
            </button>
            <button
                css={materialIconCss}
                onClick={() => {
                    if (!props.bubble) return;
                    const imgContainer = props.bubble.getElementsByClassName(
                        "bloom-imageContainer"
                    )[0] as HTMLElement;
                    if (!imgContainer) return;
                    deleteBubble();
                }}
            >
                <TrashIcon color="primary" />
            </button>
            <button
                css={materialIconCss}
                onClick={() => {
                    if (!props.bubble) return;
                    const imgContainer = props.bubble.getElementsByClassName(
                        "bloom-imageContainer"
                    )[0] as HTMLElement;
                    if (!imgContainer) return;
                    showCopyrightAndLicenseDialog(
                        getImageUrlFromImageContainer(imgContainer)
                    );
                }}
            >
                <MenuIcon color="primary" />
            </button>
        </div>
    );
};

export function renderBubbleToolbox(bubble: HTMLElement) {
    const root = document.getElementById("bubble-toolbox");
    if (!root) {
        // not created yet, try later
        setTimeout(() => renderBubbleToolbox(bubble), 200);
        return;
    }
    ReactDOM.render(<BubbleToolbox bubble={bubble} />, root);
}
