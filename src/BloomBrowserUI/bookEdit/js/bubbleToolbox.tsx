import { jsx, css } from "@emotion/react";

import * as React from "react";
import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import * as ReactDOM from "react-dom";
import { kBloomBlue, lightTheme } from "../../bloomMaterialUITheme";
import { default as CopyrightIcon } from "@mui/icons-material/Copyright";
import { default as SearchIcon } from "@mui/icons-material/Search";
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
import { copySelection, GetEditor, pasteClipboard } from "./bloomEditing";
import { BloomTooltip } from "../../react_components/BloomToolTip";
import { TrashIcon } from "../toolbox/overlay/TrashIcon";

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
        top: -4px; // wants 3px if we remove align-items:start
        position: relative;
        svg {
            font-size: 1.7rem;
        }
    `;
    const svgIconCss = css`
        width: 22px;
        position: relative;
        //top: 7px; // restore if we remove align-items:start
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
            icon: (
                <TrashIcon
                    color="black"
                    css={css`
                        position: relative;
                        top: -5px;
                        left: -4px;
                    `}
                />
            )
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
    const editable = props.bubble.getElementsByClassName(
        "bloom-editable bloom-visibility-code-on"
    )[0] as HTMLElement;
    const langName = editable?.getAttribute("data-languagetipcontent"); // todo: pretty name
    if (editable) {
        menuOptions.unshift(
            {
                l10nId: "EditTab.Toolbox.ComicTool.Options.Format",
                english: "Format",
                onClick: () => GetEditor().runFormatDialog(editable),
                icon: (
                    <img
                        css={css`
                            width: 19px;
                        `}
                        src="/bloom/bookEdit/img/cog.svg"
                    />
                )
            },
            {
                l10nId: "EditTab.Toolbox.ComicTool.Options.CopyText",
                english: "Copy Text",
                onClick: () => copySelection(),
                icon: <CopyIcon css={muiMenIconCss} />
            },
            {
                l10nId: "EditTab.Toolbox.ComicTool.Options.PasteText",
                english: "Paste Text",
                // We don't actually know there's no image on the clipboard, but it's not relevant for a text box.
                onClick: () => pasteClipboard(false),
                icon: <PasteIcon css={muiMenIconCss} />
            },
            {
                l10nId: "-",
                english: "",
                onClick: () => {}
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
                    align-items: start;
                    padding: 4px 10px;
                    margin: 0 auto 0 auto;
                    width: fit-content;
                    pointer-events: all;
                `}
            >
                {hasImage && (
                    <Fragment>
                        {
                            // latest card says we don't want this as a button ever.
                            // isPlaceHolder || (
                            //     <BloomTooltip
                            //         id="metadata"
                            //         placement="top"
                            //         tip={{
                            //             l10nKey: "EditTab.Image.EditMetadata"
                            //         }}
                            //     >
                            //         <button
                            //             css={
                            //                 hasLicenseProblem
                            //                     ? svgIconCss
                            //                     : materialIconCss
                            //             }
                            //             onClick={runMetadataDialog}
                            //         >
                            //             {hasLicenseProblem ? (
                            //                 <img src="/bloom/bookEdit/img/Missing Metadata.svg" />
                            //             ) : (
                            //                 <CopyrightIcon color="primary" />
                            //             )}
                            //         </button>
                            //     </BloomTooltip>
                            // )
                        }
                        {isPlaceHolder && (
                            <BloomTooltip
                                id="chooseImage"
                                placement="top"
                                tip={{
                                    l10nKey: "EditTab.Image.ChooseImage"
                                }}
                            >
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
                            </BloomTooltip>
                        )}
                        {isPlaceHolder && (
                            <BloomTooltip
                                id="pasteImage"
                                placement="top"
                                tip={{
                                    l10nKey: "EditTab.Image.PasteImage"
                                }}
                            >
                                <button
                                    css={materialIconCss}
                                    style={{ marginRight: "20px" }}
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
                                            "paste"
                                        );
                                    }}
                                >
                                    <PasteIcon color="primary" />
                                </button>
                            </BloomTooltip>
                        )}
                    </Fragment>
                )}
                {editable && (
                    <div
                        css={css`
                            display: flex;
                            flex-direction: column;
                            margin-right: 10px;
                        `}
                    >
                        <BloomTooltip
                            id="format"
                            placement="top"
                            tip={{
                                l10nKey:
                                    "EditTab.Toolbox.ComicTool.Options.Format"
                            }}
                        >
                            <button
                                css={svgIconCss}
                                style={{ top: 0, width: "26px" }}
                                onClick={() => {
                                    if (!props.bubble) return;
                                    GetEditor().runFormatDialog(editable);
                                }}
                            >
                                <img
                                    // A trick to make it bloom-blue
                                    // To generate new filter rules like this, use https://codepen.io/sosuke/pen/Pjoqqp
                                    // But it would be better still to make a react element SVG that can be any color.
                                    css={css`
                                        filter: invert(38%) sepia(93%)
                                            saturate(422%) hue-rotate(140deg)
                                            brightness(93%) contrast(96%);
                                    `}
                                    src="/bloom/bookEdit/img/cog.svg"
                                />
                            </button>
                        </BloomTooltip>
                        <div
                            css={css`
                                color: ${kBloomBlue};
                                font-size: 10px;
                                margin-top: -3px;
                            `}
                        >
                            {langName}
                        </div>
                    </div>
                )}
                <BloomTooltip
                    id="format"
                    placement="top"
                    tip={{
                        l10nKey: "EditTab.Toolbox.ComicTool.Options.Duplicate"
                    }}
                >
                    <button
                        css={svgIconCss}
                        onClick={() => {
                            if (!props.bubble) return;
                            makeDuplicateOfDragBubble();
                        }}
                    >
                        <img src="/bloom/bookEdit/img/Duplicate.svg" />
                    </button>
                </BloomTooltip>
                <BloomTooltip
                    id="format"
                    placement="top"
                    tip={{
                        l10nKey: "Common.Delete"
                    }}
                >
                    <button
                        css={materialIconCss}
                        onClick={() => {
                            if (!props.bubble) return;
                            deleteBubble();
                        }}
                    >
                        <TrashIcon color={kBloomBlue} />
                    </button>
                </BloomTooltip>
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
                                &.MuiDivider-root {
                                    margin-bottom: 12px;
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
                            return (
                                <Divider
                                    key={index}
                                    variant="middle"
                                    component="li"
                                />
                            );
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
