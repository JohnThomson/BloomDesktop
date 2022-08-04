import * as React from "react";
import FormGroup from "@material-ui/core/FormGroup";
import { ApiCheckbox } from "../../react_components/ApiCheckbox";
import { SettingsGroup } from "../commonPublish/PublishScreenBaseComponents";
import { useL10n } from "../../react_components/l10nHooks";
import { BloomApi } from "../../utils/bloomApi";
import { useSubscribeToWebSocketForObject } from "../../utils/WebSocketManager";
import { useState } from "react";

interface PdfReadyMessage {
    path: string;
}

export const PDFPrintFeaturesGroup: React.FunctionComponent<{
    onChange?: () => void;
    onGotPdf: (path: string) => void;
}> = props => {
    useSubscribeToWebSocketForObject(
        "publish",
        "pdfReady",
        (message: PdfReadyMessage) => {
            props.onGotPdf(message.path);
        }
    );
    return (
        <div>
            <SettingsGroup
                label={useL10n(
                    "Booklet Mode",
                    "PublishTab.PdfPrint.BookletModes"
                )}
            >
                <FormGroup>
                    {/*
                    Eventually this FormGroup will hold large buttons for Simple, Booklet Cover and
                    Booklet Insides PDF options.
                    */}
                    <button onClick={() => BloomApi.post("publish/pdf/simple")}>
                        Simple
                    </button>
                </FormGroup>
            </SettingsGroup>
            <SettingsGroup
                label={useL10n(
                    "Prepare for Printshop",
                    "PublishTab.PdfPrint.PrintshopOptions"
                )}
            >
                <FormGroup>
                    {/*
                    I'm just creating the framework here. After we get the basic PDF creation
                    working, we'll add an ApiCheckbox for Full Bleed and a CMYK dropdown options field
                    inside of this FormGroup.
                    */}
                </FormGroup>
            </SettingsGroup>
        </div>
    );
};
