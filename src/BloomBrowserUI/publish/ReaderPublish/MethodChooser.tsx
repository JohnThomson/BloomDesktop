/** @jsx jsx **/
import { jsx, css } from "@emotion/core";

import * as React from "react";
import { RadioGroup } from "../../react_components/RadioGroup";
import BloomButton from "../../react_components/bloomButton";
import { BloomApi } from "../../utils/bloomApi";
import { isLinux } from "../../utils/isLinux";
import { useL10n } from "../../react_components/l10nHooks";
import Typography from "@material-ui/core/Typography";
import { LocalizedString } from "../../react_components/l10nComponents";
import { default as InfoIcon } from "@material-ui/icons/InfoOutlined";
import HtmlHelpLink from "../../react_components/htmlHelpLink";
import { kMutedTextGray } from "../../bloomMaterialUITheme";
import { kBloomWarning } from "../../utils/colorUtils";

// Needs require. import ... from ... syntax compiles, but doesn't load the image.
import wifiImage = require("./publish-via-wifi.svg");
import usbImage = require("./publish-via-usb.svg");
import fileImage = require("./publish-to-file.svg");

const methodNameToImageUrl = {
    wifi: wifiImage,
    usb: usbImage,
    file: fileImage
};

// Lets the user choose how they want to "publish" the bloompub, along with a button to start that process.
// This is a set of radio buttons and image that goes with each choice, plus a button to start off the sharing/saving
export const MethodChooser: React.FunctionComponent = () => {
    const [method, setMethod] = BloomApi.useApiStringState(
        "publish/android/method",
        "wifi"
    );
    const isLicenseOK = BloomApi.useWatchBooleanEvent(
        true,
        "publish-android",
        "publish/licenseOK"
    );

    const methodImage = (methodNameToImageUrl as any)[method];

    return (
        <React.Fragment>
            <div
                css={css`
                    display: flex;
                    flex-direction: row;
                    // Setting the height to 100% here makes the box layout extend below where it should go by the
                    // amount of the padding-top.  (8px of that is swallowed up by the default 8px margin on body.)
                    // We don't really need to set the height here anyway: it displays just fine without being
                    // explicitly set.  See https://issues.bloomlibrary.org/youtrack/issue/BL-7506.

                    // The center of a selected radio button is drawn with an <svg> element by materialui.
                    // For some reason, in Firefox 45, in Publish:Reader, the "left" says 20.4667px, whereas
                    // it says 0px in modern browsers. A mystery. Anyhow this resets it.
                    // (I expected unset to fix it, but it doesn't.)
                    .MuiRadio-root svg {
                        left: 0;
                    }
                `}
            >
                <div
                    css={css`
                        display: flex;
                        flex-direction: column;
                        flex-shrink: 0;
                        // leave room for the image, wrap radios if translations are really long
                        padding-right: 20px;
                        .MuiFormControl-root {
                            margin-top: 0;
                        }
                    `}
                >
                    <RadioGroup
                        value={method}
                        onChange={m => setMethod(m)}
                        choices={{
                            wifi: useL10n(
                                "Share over Wi-Fi",
                                "PublishTab.Android.ChooseWifi"
                            ),
                            file: useL10n(
                                "Save BloomPUB File",
                                "PublishTab.Android.ChooseBloomPUBFile"
                            ),
                            usb: useL10n(
                                "Send over USB Cable",
                                "PublishTab.Android.ChooseUSB"
                            )
                        }}
                    />
                    {getStartButton(method, isLicenseOK)}
                </div>
                <div
                    css={css`
                        max-width: 400px; // this is just to limit the hint text length on a big monitor.
                        display: flex;
                        flex-direction: column;
                        flex-grow: 1;
                        padding-left: 20px;
                        padding-right: 20px;
                    `}
                >
                    <img
                        css={css`
                            width: 200px;
                            object-fit: contain;
                            margin-bottom: 20px;
                        `}
                        src={methodImage}
                        alt="An image that just illustrates the currently selected publishing method."
                    />
                    {getHint(method)}
                </div>
            </div>
        </React.Fragment>
    );
};

function getStartButton(method: string, licenseOK: boolean) {
    const buttonCss = "align-self: flex-end;";
    switch (method) {
        case "file":
            return (
                <BloomButton
                    css={css`
                        ${buttonCss}
                    `}
                    l10nKey="PublishTab.Save"
                    l10nComment="Button that tells Bloom to save the book in the current format."
                    clickApiEndpoint="publish/android/file/save"
                    enabled={licenseOK}
                    hasText={true}
                >
                    Save...
                </BloomButton>
            );
        case "usb":
            return (
                <BloomButton
                    css={css`
                        ${buttonCss}
                    `}
                    l10nKey="PublishTab.Android.Usb.Start"
                    l10nComment="Button that tells Bloom to send the book to a device via USB cable."
                    enabled={licenseOK}
                    clickApiEndpoint="publish/android/usb/start"
                    hidden={isLinux()}
                    hasText={true}
                >
                    Connect with USB cable
                </BloomButton>
            );
        case "wifi":
            return (
                <BloomButton
                    css={css`
                        ${buttonCss}
                    `}
                    l10nKey="PublishTab.Android.Wifi.Start"
                    l10nComment="Button that tells Bloom to begin offering this book on the wifi network."
                    enabled={licenseOK}
                    clickApiEndpoint="publish/android/wifi/start"
                    hasText={true}
                >
                    Share
                </BloomButton>
            );
        default:
            throw new Error("Unhandled method choice");
    }
}

function getHint(method: string) {
    // Despite Typography using 'variant="h6"', the actual element used is "h1", so we target that.
    // Also, the "!important" below is needed to overrule MUI's typography default.
    const hintHeadingCss =
        "display: flex;\nalign-items: center;\nh1 { margin-left: 10px !important; }";
    switch (method) {
        case "file":
            return (
                <React.Fragment>
                    <div
                        css={css`
                            ${hintHeadingCss}
                        `}
                    >
                        <InfoIcon color="primary" />
                        <Typography variant="h6">
                            <LocalizedString l10nKey="PublishTab.Android.BloomPUB.Hint.Heading">
                                Sharing BloomPUB Files
                            </LocalizedString>
                        </Typography>
                    </div>
                    <Typography
                        css={css`
                            color: ${kMutedTextGray};
                            a {
                                color: ${kMutedTextGray};
                            }
                        `}
                    >
                        <LocalizedString
                            l10nKey="PublishTab.Android.BloomPUB.Hint"
                            l10nComment="The 3 links should be left untranslated as well as the file type '.bloompub'. Beware of machine translations that eliminate the 'b'."
                        >
                            You can use SD cards and sharing apps like email,
                            Google Drive, and WhatsApp to get your .bloompub
                            file onto a device that has{" "}
                            <a href="https://bloomlibrary.org/page/create/bloom-reader">
                                Bloom Reader
                            </a>{" "}
                            (Android) or{" "}
                            <a href="https://bloomlibrary.org/page/create/downloads#related-software">
                                BloomPUB Viewer
                            </a>{" "}
                            (Windows). You can also create a stand-alone app
                            using{" "}
                            <a href="https://software.sil.org/readingappbuilder/">
                                Reading App Builder
                            </a>
                            .
                        </LocalizedString>
                    </Typography>
                    <div
                        css={css`
                            height: 1em !important;
                        `}
                    />
                    <Typography
                        css={css`
                            color: ${kMutedTextGray};
                            a {
                                color: ${kMutedTextGray};
                            }
                        `}
                    >
                        <LocalizedString
                            l10nKey="PublishTab.Android.BloomPUB.Hint2"
                            l10nComment="The link should be left untranslated as well as the file type 'BloomPUB'."
                        >
                            Note that when you upload your book to{" "}
                            <a href="https://bloomlibrary.org/">
                                BloomLibrary.org
                            </a>
                            , we will create a BloomPUB file for you that people
                            can download.
                        </LocalizedString>
                    </Typography>
                </React.Fragment>
            );
        case "usb":
            return (
                <React.Fragment>
                    <Typography
                        css={css`
                            margin-bottom: 10px;
                        `}
                    >
                        <LocalizedString l10nKey="PublishTab.Android.USB.OpenMenuItem">
                            On the Android device, run Bloom Reader, open the
                            menu and choose 'Receive books via USB'.
                        </LocalizedString>
                    </Typography>
                    <div
                        css={css`
                            ${hintHeadingCss}
                        `}
                    >
                        <InfoIcon htmlColor={kBloomWarning} />
                        <Typography variant="h6">
                            <LocalizedString l10nKey="PublishTab.Android.USB.Hint.Heading">
                                USB is Difficult
                            </LocalizedString>
                        </Typography>
                    </div>
                    <Typography
                        css={css`
                            color: ${kMutedTextGray};
                        `}
                    >
                        <LocalizedString l10nKey="PublishTab.Android.USB.Hint">
                            To Send via USB, you may need to get the right
                            cable, install phone drivers on your computer, or
                            modify settings on your phone.
                        </LocalizedString>
                    </Typography>
                </React.Fragment>
            );
        case "wifi":
            return (
                <React.Fragment>
                    <div
                        css={css`
                            ${hintHeadingCss}
                        `}
                    >
                        <InfoIcon color="primary" />
                        <Typography variant="h6">
                            <LocalizedString l10nKey="PublishTab.Android.WiFi.Hint.Heading">
                                No Wi-Fi Network?
                            </LocalizedString>
                        </Typography>
                    </div>
                    <Typography
                        css={css`
                            color: ${kMutedTextGray};
                        `}
                    >
                        <LocalizedString
                            l10nKey="PublishTab.Android.WiFi.Hint"
                            l10nComment="This is preceded by a heading that says 'No Wi-Fi Network'. 'one' here refers to 'Wi Fi' network."
                        >
                            There are several ways to start a temporary one.
                        </LocalizedString>
                        &nbsp;
                        <HtmlHelpLink
                            l10nKey="Common.LearnMore"
                            fileid="Publish-WiFi-Network"
                        >
                            Learn More
                        </HtmlHelpLink>
                    </Typography>
                </React.Fragment>
            );
        default:
            throw new Error("Unhandled method choice");
    }
}
