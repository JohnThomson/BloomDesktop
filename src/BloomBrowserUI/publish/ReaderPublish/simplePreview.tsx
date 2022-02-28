/** @jsx jsx **/
import { jsx, css } from "@emotion/core";
import * as React from "react";
import "./DeviceFrame.less";
import { useState, useEffect } from "react";
import { useL10n } from "../../react_components/l10nHooks";
import { useDrawAttention } from "../../react_components/UseDrawAttention";
import { useTheme, Theme, Typography } from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import RefreshIcon from "@material-ui/icons/Refresh";


export const SimplePreview: React.FunctionComponent<{
    landscape: boolean;
    url: string;
}> = props => {
    const theme: Theme = useTheme();

    // Desktop pixels are much larger, so things come out bloated.
// For now what we do is make the player & readium think we have twice the pixels,
// then shrink it all.
const pixelDensityMultiplier=2;
const scale = 25;
const screenWidth= 9 * scale;
const screenHeight: 16 * scale;

var iframeClasses = "";
if (props.landscape) {
    iframeClasses =`
    height: (${pixelDensityMultiplier} * 900% / 16);
            width: (${pixelDensityMultiplier} * 1600%/9);
            transform: rotate(90deg  translate(0, -${screenWidth}
                scale(1 / ${pixelDensityMultiplier});
                `;

} else {
    iframeClasses =`transform: translate(143px, 0)
    width: ${pixelDensityMultiplier} * 100% !important;
            height: {{pixelDensityMultiplier} * 100% !important;
            transform: scale(1 / ${pixelDensityMultiplier});
            `;

}

var rootClasses = "";
if (props.landscape) {
    rootClasses = `transform-origin: top left;
    transform: translate(0, ${screenWidth} )
        rotate(-90deg ) scale(var(--${scale});`
}

    return (
        <div>
            <div
            css={css`
            height: 400px; // Enhance: could be conditional on landscape
            width: 400px;
            ${rootClasses}
            background-color:
            `}
            >
                <iframe css={css`
                background-color: black;
                border: none;
                flex-shrink: 0; // without this, the height doesn't grow
                transform-origin: top left;
                ${iframeClasses}
                `}
                    title="book preview"
                    src={props.url}
                />
            </div>
        </div>
    );
};

