/** @jsx jsx **/
import { jsx, css } from "@emotion/core";
import * as React from "react";
import { useState, useContext } from "react";
import PlayIcon from "@material-ui/icons/PlayCircleFilledWhite";
import PauseIcon from "@material-ui/icons/PauseCircleFilled";
import SkipPreviousIcon from "@material-ui/icons/SkipPrevious";
import SaveIcon from "@material-ui/icons/Save";
import RecordIcon from "@material-ui/icons/RadioButtonChecked";

import {
    BasePublishScreen,
    PreviewPanel,
    PublishPanel,
    HelpGroup,
    SettingsPanel,
    CommandsGroup
} from "../commonPublish/BasePublishScreen";
import { MethodChooser } from "./MethodChooser";
import { PublishFeaturesGroup } from "./PublishFeaturesGroup";
import { ThumbnailGroup } from "./ThumbnailGroup";
import "./ReaderPublish.less";
import ReactDOM = require("react-dom");
import { ThemeProvider } from "@material-ui/styles";
import { darkTheme, kBloomBlue, lightTheme } from "../../bloomMaterialUITheme";
import { StorybookContext } from "../../.storybook/StoryBookContext";
import {
    useSubscribeToWebSocketForStringMessage,
    useSubscribeToWebSocketForEvent
} from "../../utils/WebSocketManager";
import { BloomApi } from "../../utils/bloomApi";
import HelpLink from "../../react_components/helpLink";
import HtmlHelpLink from "../../react_components/htmlHelpLink";
import { Link, LinkWithDisabledStyles } from "../../react_components/link";
import {
    RequiresBloomEnterpriseAdjacentIconWrapper,
    RequiresBloomEnterpriseDialog
} from "../../react_components/requiresBloomEnterprise";
import { PublishProgressDialog } from "../commonPublish/PublishProgressDialog";
import { useL10n } from "../../react_components/l10nHooks";
import { ProgressState } from "../commonPublish/PublishProgressDialogInner";
import { PublishLanguagesGroup } from "./PublishLanguagesGroup";
import {
    BulkBloomPubDialog,
    showBulkBloomPubDialog
} from "./BulkBloomPub/BulkBloomPubDialog";
import BloomButton from "../../react_components/bloomButton";
import {
    Button,
    FormGroup,
    Step,
    StepContent,
    StepLabel,
    Stepper
} from "@material-ui/core";
import { kBloomRed } from "../../utils/colorUtils";
import { SimplePreview } from "./simplePreview";
import { VideoOptionsGroup } from "./VideoOptionsGroup";
import { Div } from "../../react_components/l10nComponents";
import { ApiCheckbox } from "../../react_components/ApiCheckbox";
import { InfoBox } from "../../react_components/infoBox";

export const RecordVideoWindow = () => {
    // When the user changes some features, included languages, etc., we
    // need to rebuild the book and re-run all of our Bloom API queries.
    // This requires a hard-reset of the whole screen, which we do by
    // incrementing a `key` prop on the core of this screen.
    const [keyForReset, setKeyForReset] = useState(0);
    return (
        <RecordVideoWindowInternal
            key={keyForReset}
            onReset={() => {
                setKeyForReset(keyForReset + 1);
            }}
        />
    );
};

const landscapeWidth = 600;

/// What BloomPlayer reportBookProperties sends.
interface IBookProps {
    landscape: boolean;
    canRotate: boolean;
    hasActivities: boolean;
    hasAnimation: boolean;
}

const RecordVideoWindowInternal: React.FunctionComponent<{
    onReset: () => void;
}> = props => {
    const inStorybookMode = useContext(StorybookContext);
    const [heading, setHeading] = useState(
        useL10n("Creating Digital Book", "PublishTab.Android.Creating")
    );
    const [closePending, setClosePending] = useState(false);
    const [pageReadTime, setPageReadTime] = useState(3);
    const [highlightRefresh, setHighlightRefresh] = useState(false);
    const [progressState, setProgressState] = useState(ProgressState.Working);
    const [activeStep, setActiveStep] = useState(0);
    const gotRecording = BloomApi.useWatchBooleanEvent(
        false,
        "recordVideo",
        "ready"
    );
    const [canModifyCurrentBook] = BloomApi.useApiBoolean(
        "common/canModifyCurrentBook",
        false
    );

    const [motionEnabled] = BloomApi.useApiBoolean(
        "publish/android/canHaveMotionMode",
        false
    );
    const [hasActivities] = BloomApi.useApiBoolean(
        "publish/video/hasActivities",
        false
    );
    React.useEffect(() => {
        if (activeStep < 2 && gotRecording) {
            setActiveStep(2);
        }
        if (activeStep >= 2 && !gotRecording) {
            setActiveStep(1);
        }
    }, [gotRecording]);
    // React.useEffect(() => {
    //     window.addEventListener("message", data => {
    //         // ignore messages without the interesting sort of data
    //         if (!data || !data.data || data.data.length === 0) {
    //             //console.log("returning early");
    //             return;
    //         }
    //         const messageData = JSON.parse(data.data);
    //         if (messageData.messageType !== "reportBookProperties") {
    //             return;
    //         }
    //         const bookProps = messageData.params as IBookProps;
    //         if (bookProps.hasActivities && !hasActivities) {
    //             setHasActivities(true);
    //         }
    //     });
    // }, []);

    // bookUrl is expected to be a normal, well-formed URL.
    // (that is, one that you can directly copy/paste into your browser and it would work fine)
    const [bookUrl, setBookUrl] = useState(
        inStorybookMode
            ? window.location.protocol +
                  "//" +
                  window.location.host +
                  "/templates/Sample Shells/The Moon and the Cap" // Enhance: provide an actual bloomd in the source tree
            : // otherwise, wait for the websocket to deliver a url when the c# has finished creating the bloomd.
              //BloomPlayer recognizes "working" as a special value; it will show some spinner or some such.
              "working"
    );

    const [defaultLandscape] = BloomApi.useApiBoolean(
        "publish/android/defaultLandscape",
        false
    );
    const [canRotate] = BloomApi.useApiBoolean(
        "publish/android/canRotate",
        false
    );
    useSubscribeToWebSocketForStringMessage(
        "publish-android",
        "androidPreview",
        url => {
            setBookUrl(url);
        }
    );
    const pathToOutputBrowser = inStorybookMode ? "./" : "../../";
    const usbWorking = useL10n("Publishing", "PublishTab.Common.Publishing");
    const wifiWorking = useL10n("Publishing", "PublishTab.Common.Publishing");

    useSubscribeToWebSocketForEvent(
        "publish-android",
        "publish/android/state",
        e => {
            switch (e.message) {
                case "stopped":
                    setClosePending(true);
                    break;
                case "UsbStarted":
                    setClosePending(false);
                    setHeading(usbWorking);
                    setProgressState(ProgressState.Serving);
                    break;
                case "ServingOnWifi":
                    setClosePending(false);
                    setHeading(wifiWorking);
                    setProgressState(ProgressState.Serving);
                    break;
                default:
                    throw new Error(
                        "Method Chooser does not understand the state: " +
                            e.message
                    );
            }
        }
    );
    const sendMessageToPlayer = (msg: any) => {
        var preview = document.getElementById(
            "simple-preview"
        ) as HTMLIFrameElement;
        msg.messageType = "control";
        preview.contentWindow?.postMessage(JSON.stringify(msg), "*");
    };
    const play = () => {
        sendMessageToPlayer({ play: true, autoplay: "yes" });
    };
    const pause = () => {
        sendMessageToPlayer({ pause: true });
    };
    const reset = () => {
        sendMessageToPlayer({ reset: true });
    };
    const activitiesSkipped = useL10n(
        "Activities will be skipped",
        "PublishTab.RecordVideo.ActivitiesSkipped"
    );
    const circleHeight = "0.88rem";
    const blurbClasses = `
    font-size: smaller;
    max-width: ${landscapeWidth}px;
    margin-bottom:5px;
    color: grey;`;
    return (
        <React.Fragment>
            <BulkBloomPubDialog />
            <RequiresBloomEnterpriseDialog />
            <BasePublishScreen
                className="ReaderPublishScreen"
                // Be careful! only specified children (PreviewPanel, PublishPanel, SettingsPanel, HelpGroup)
                // will be shown!
            >
                <PublishPanel>
                    <Stepper
                        activeStep={activeStep}
                        orientation="vertical"
                        // defeat Material-UI's attempt to make the step numbers and text look disabled.
                        css={css`
                            .MuiStepLabel-label {
                                color: black !important;
                                font-size: larger;
                            }
                            .MuiStepIcon-root {
                                color: ${kBloomBlue} !important;
                            }
                        `}
                    >
                        <Step expanded={true}>
                            <StepLabel>Configure &amp; Preview</StepLabel>
                            <StepContent>
                                <ThemeProvider theme={darkTheme}>
                                    <Div
                                        css={css`
                                            ${blurbClasses}
                                        `}
                                        l10nKey="PublishTab.RecordVideo.Instructions"
                                    >
                                        Use the red buttons above the book
                                        player to select the language and other
                                        settings.
                                    </Div>
                                    <SimplePreview
                                        landscape={defaultLandscape}
                                        landscapeWidth={landscapeWidth}
                                        url={
                                            pathToOutputBrowser +
                                            "bloom-player/dist/bloomplayer.htm?centerVertically=true&videoPreviewMode=true&autoplay=no&defaultDuration=" +
                                            pageReadTime +
                                            "&url=" +
                                            encodeURIComponent(bookUrl) + // Need to apply encoding to the bookUrl again as data to use it as a parameter of another URL
                                            "&independent=false&host=bloomdesktop&skipActivities=true&hideNavButtons=true"
                                        }
                                    />
                                    <div
                                        css={css`
                                            display: flex;
                                            width: ${landscapeWidth}px;
                                            justify-content: center;
                                        `}
                                    >
                                        <Button onClick={reset}>
                                            <SkipPreviousIcon
                                                // unfortunately this icon doesn't come in a variant with a built-in circle.
                                                // To make it match the other two we have to shrink it, make it white,
                                                // and carefully position an independent circle behind it.
                                                css={css`
                                                    color: white;
                                                    font-size: 1.5rem;
                                                    z-index: 1;
                                                `}
                                            />
                                            <div
                                                css={css`
                                                    border: ${circleHeight}
                                                        solid ${kBloomBlue};
                                                    border-radius: ${circleHeight};
                                                    position: absolute;
                                                    top: 0.5rem;
                                                    left: 1.1rem;
                                                `}
                                            ></div>
                                        </Button>
                                        <Button onClick={play}>
                                            <PlayIcon
                                                css={css`
                                                    color: ${kBloomBlue};
                                                    font-size: 2rem;
                                                `}
                                            />
                                        </Button>
                                        <Button onClick={pause}>
                                            <PauseIcon
                                                css={css`
                                                    color: ${kBloomBlue};
                                                    font-size: 2rem;
                                                `}
                                            />
                                        </Button>
                                    </div>
                                </ThemeProvider>
                            </StepContent>
                        </Step>
                        <Step expanded={true} disabled={false}>
                            <StepLabel onClick={() => setActiveStep(1)}>
                                Make Recording
                            </StepLabel>
                            <StepContent
                                css={css`
                                    .MuiButtonBase-root {
                                        background-color: ${kBloomRed} !important;
                                    }
                                `}
                            >
                                <Div
                                    css={css`
                                        ${blurbClasses}
                                    `}
                                    l10nKey="PublishTab.RecordVideo.WillOpenRecordingWindow"
                                >
                                    This will open a window and play the whole
                                    book. Bloom will record it to match the
                                    “Format” option in the upper right of this
                                    screen.
                                </Div>
                                <BloomButton
                                    enabled={true}
                                    l10nKey="PublishTab.RecordVideo.Record"
                                    clickApiEndpoint="publish/video/recordVideo"
                                    iconBeforeText={
                                        <RecordIcon
                                            css={css`
                                                color: white;
                                            `}
                                        />
                                    }
                                >
                                    Record
                                </BloomButton>
                            </StepContent>
                        </Step>
                        <Step expanded={true} disabled={false}>
                            <StepLabel>Check Recording</StepLabel>
                            <StepContent>
                                <Div
                                    css={css`
                                        ${blurbClasses}
                                    `}
                                    l10nKey="PublishTab.RecordVideo.WillOpenProgram"
                                >
                                    This will open the program on your computer
                                    that is associated wtih this file type.
                                </Div>
                                <BloomButton
                                    enabled={gotRecording}
                                    l10nKey="PublishTab.RecordVideo.Play"
                                    clickApiEndpoint="publish/video/playVideo"
                                    iconBeforeText={
                                        <PlayIcon
                                            css={css`
                                                color: white;
                                            `}
                                        />
                                    }
                                >
                                    Play Recording
                                </BloomButton>
                            </StepContent>
                        </Step>
                        <Step
                            expanded={true}
                            disabled={false}
                            onClick={() => setActiveStep(3)}
                        >
                            <StepLabel>Save</StepLabel>
                            <StepContent>
                                <BloomButton
                                    enabled={gotRecording}
                                    l10nKey="PublishTab.Save"
                                    clickApiEndpoint="publish/video/saveVideo"
                                    iconBeforeText={
                                        <SaveIcon
                                            css={css`
                                                color: white;
                                            `}
                                        />
                                    }
                                >
                                    Save...
                                </BloomButton>
                            </StepContent>
                        </Step>
                    </Stepper>
                </PublishPanel>

                <SettingsPanel>
                    <VideoOptionsGroup
                        pageDuration={pageReadTime}
                        onSetPageDuration={time => {
                            setPageReadTime(time);
                            BloomApi.postString(
                                "publish/video/pageReadTime",
                                time.toString()
                            );
                        }}
                    ></VideoOptionsGroup>
                    {motionEnabled && (
                        <FormGroup
                            css={css`
                                margin-top: 20px;
                            `}
                        >
                            <ApiCheckbox
                                english="Motion Book"
                                l10nKey="PublishTab.Android.MotionBookMode"
                                // tslint:disable-next-line:max-line-length
                                l10nComment="Motion Books are Talking Books in which the picture fills the screen, then pans and zooms while you hear the voice recording. This happens only if you turn the book sideways."
                                apiEndpoint="publish/android/motionBookMode"
                                disabled={!canModifyCurrentBook}
                            />
                        </FormGroup>
                    )}

                    {/* push everything to the bottom */}
                    <div
                        css={css`
                            margin-top: auto;
                        `}
                    />
                    {hasActivities && <InfoBox text={activitiesSkipped} />}
                    <HelpGroup>
                        <HelpLink
                            l10nKey="PublishTab.Android.AboutBookFeatures"
                            helpId="Tasks/Publish_tasks/Features.htm"
                        >
                            About Book Features
                        </HelpLink>
                    </HelpGroup>
                </SettingsPanel>
            </BasePublishScreen>
            {/* In storybook, there's no bloom backend to run the progress dialog */}
            {inStorybookMode || (
                <PublishProgressDialog
                    heading={heading}
                    startApiEndpoint="publish/video/updatePreview"
                    webSocketClientContext="publish-android"
                    progressState={progressState}
                    setProgressState={setProgressState}
                    closePending={closePending}
                    setClosePending={setClosePending}
                    onUserStopped={() => {
                        setClosePending(true);
                    }}
                />
            )}
        </React.Fragment>
    );
};

// a bit goofy... currently the html loads everything in publishUIBundlejs. So all the publish screens
// get any not-in-a-class code called, including ours. But it only makes sense to get wired up
// if that html has the root page we need.
// WE could now switch to doing this with ReactControl. But it's easier if all the publish HTML
// panels work the same way.
if (document.getElementById("RecordVideoScreen")) {
    ReactDOM.render(
        <ThemeProvider theme={lightTheme}>
            <RecordVideoWindow />
        </ThemeProvider>,
        document.getElementById("RecordVideoScreen")
    );
}
