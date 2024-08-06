import { jsx, css } from "@emotion/react";

import * as React from "react";
import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import * as ReactDOM from "react-dom";
import { kBloomBlue, lightTheme } from "../../bloomMaterialUITheme";
import { default as CopyrightIcon } from "@mui/icons-material/Copyright";
import { default as SearchIcon } from "@mui/icons-material/Search";
import { default as TrashIcon } from "@mui/icons-material/Delete";
import { default as MenuIcon } from "@mui/icons-material/MoreHorizSharp";
import { default as CopyIcon } from "@mui/icons-material/ContentCopy";
import { default as CutIcon } from "@mui/icons-material/ContentCut";
import { default as PasteIcon } from "@mui/icons-material/ContentPaste";
import { showCopyrightAndLicenseDialog } from "../editViewFrame";
import { doImageCommand, getImageUrlFromImageContainer } from "./bloomImages";
import { makeDuplicateOfDragBubble } from "../toolbox/dragActivity/dragActivityTool";
import { deleteBubble, duplicateBubble } from "../toolbox/overlay/overlayTool";
import { ThemeProvider } from "@mui/material/styles";
import {
    ILocalizableMenuItemProps,
    LocalizableMenuItem
} from "../../react_components/localizableMenuItem";
import Menu from "@mui/material/Menu";
import { Divider } from "@mui/material";
import { DuplicateIcon } from "./DuplicateIcon";
import { BubbleManager } from "./bubbleManager";

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

    const runMetadataDialog = () => {
        if (!props.bubble) return;
        const imgContainer = props.bubble.getElementsByClassName(
            "bloom-imageContainer"
        )[0] as HTMLElement;
        if (!imgContainer) return;
        showCopyrightAndLicenseDialog(
            getImageUrlFromImageContainer(imgContainer)
        );
    };

    const [open, setOpen] = useState(false);
    const menuEl = useRef<HTMLElement | null>();

    const menuIconColor = "black";
    const muiMenIconCss = css`
        color: ${menuIconColor};
    `;

    const menuOptions: ILocalizableMenuItemProps[] = [
        {
            l10nId: "EditTab.Toolbox.ComicTool.Options.Duplicate",
            english: "Duplicate",
            onClick: duplicateBubble,
            icon: (
                <DuplicateIcon
                    css={css`
                        width: 18px;
                    `}
                    color={menuIconColor}
                />
            )
        },
        {
            l10nId: "Common.Delete",
            english: "Delete",
            onClick: deleteBubble,
            icon: <TrashIcon css={muiMenIconCss} />
        }
    ];
    if (hasImage) {
        menuOptions.unshift(
            {
                l10nId: "EditTab.Image.ChooseImage",
                english: "Choose image from your computer...",
                onClick: () => doImageCommand(img, "change"),
                icon: <SearchIcon css={muiMenIconCss} />
            },
            {
                l10nId: "EditTab.Image.EditMetadata",
                english: "Edit Copyright, &amp; License...",
                onClick: runMetadataDialog,
                icon: <CopyrightIcon css={muiMenIconCss} />
            },
            {
                l10nId: "-",
                english: "",
                onClick: () => {}
            }
        );
        // todo: line before these
        menuOptions.push(
            {
                l10nId: "-",
                english: "",
                onClick: () => {}
            },
            {
                l10nId: "EditTab.Image.CopyImage",
                english: "Copy image",
                onClick: () => doImageCommand(img, "copy"),
                icon: <CopyIcon css={muiMenIconCss} />
            },
            {
                l10nId: "EditTab.Image.CutImage",
                english: "Cut Image",
                onClick: () => doImageCommand(img, "cut"),
                icon: <CutIcon css={muiMenIconCss} />
            },
            {
                l10nId: "EditTab.Image.PasteImage",
                english: "Paste image",
                onClick: () => doImageCommand(img, "paste"),
                icon: <PasteIcon css={muiMenIconCss} />
            }
        );
    }

    return (
        <ThemeProvider theme={lightTheme}>
            <div
                css={css`
                    background-color: white;
                    border-radius: 3.785px;
                    border: 0.757px solid rgba(255, 255, 255, 0.2);
                    //opacity: 0.2;
                    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.25);
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
                                    hasLicenseProblem
                                        ? svgIconCss
                                        : materialIconCss
                                }
                                onClick={runMetadataDialog}
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
                    ref={ref => (menuEl.current = ref)}
                    css={materialIconCss}
                    onClick={() => setOpen(true)}
                >
                    <MenuIcon color="primary" />
                </button>
                <Menu
                    //options={menuOptions}
                    css={css`
                        ul {
                            max-width: 260px;
                            li {
                                display: flex;
                                align-items: flex-start;
                                p {
                                    white-space: initial;
                                }
                            }
                        }
                    `}
                    open={open}
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    anchorEl={menuEl.current!}
                    onClose={() => setOpen(false)}
                >
                    {menuOptions.map((option, index) => {
                        if (option.l10nId === "-") {
                            return <Divider key={index} />;
                        }
                        return (
                            <LocalizableMenuItem
                                key={index}
                                l10nId={option.l10nId}
                                english={option.english}
                                onClick={e => {
                                    setOpen(false);
                                    option.onClick(e);
                                }}
                                icon={option.icon}
                                variant="body1"
                            />
                        );
                    })}
                </Menu>
            </div>
        </ThemeProvider>
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
