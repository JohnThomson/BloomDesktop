/** @jsx jsx **/
import { jsx, css } from "@emotion/react";
import * as React from "react";
import { useState, useContext, useEffect } from "react";

import {
    PreviewPanel,
    HelpGroup,
    SettingsPanel,
    UnderPreviewPanel
} from "../commonPublish/PublishScreenBaseComponents";
import { PDFPrintFeaturesGroup } from "./PDFPrintFeaturesGroup";
import PublishScreenTemplate from "../commonPublish/PublishScreenTemplate";
import ReactDOM = require("react-dom");
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import { darkTheme, lightTheme } from "../../bloomMaterialUITheme";
import { StorybookContext } from "../../.storybook/StoryBookContext";
import { useL10n } from "../../react_components/l10nHooks";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Document, Page, Outline } from "react-pdf/dist/esm/entry.webpack";
import { CircularProgress, Dialog } from "@mui/material";
import { useWatchString } from "../../utils/bloomApi";

export const PDFPrintPublishScreen = () => {
    // When the user changes booklet mode, printshop features, etc., we
    // need to rebuild the book and re-run all of our Bloom API queries.
    // This requires a hard-reset of the whole screen, which we do by
    // incrementing a `key` prop on the core of this screen.
    const [keyForReset, setKeyForReset] = useState(0);
    return (
        <PDFPrintPublishScreenInternal
            key={keyForReset}
            onReset={() => {
                setKeyForReset(keyForReset + 1);
            }}
        />
    );
};

const PDFPrintPublishScreenInternal: React.FunctionComponent<{
    onReset: () => void;
}> = props => {
    const readable = new ReadableStream();
    const inStorybookMode = useContext(StorybookContext);
    // I left some commented code in here that may be useful in previewing; from Publish -> Android
    // const [heading, setHeading] = useState(
    //     useL10n("Creating Digital Book", "PublishTab.Android.Creating")
    // );
    // const [closePending, setClosePending] = useState(false);
    // const [highlightRefresh, setHighlightRefresh] = useState(false);
    // const [progressState, setProgressState] = useState(ProgressState.Working);

    // bookUrl is expected to be a normal, well-formed URL.
    // (that is, one that you can directly copy/paste into your browser and it would work fine)
    // const [bookUrl, setBookUrl] = useState(
    //     inStorybookMode
    //         ? window.location.protocol +
    //               "//" +
    //               window.location.host +
    //               "/templates/Sample Shells/The Moon and the Cap" // Enhance: provide an actual bloompub in the source tree
    //         : // otherwise, wait for the websocket to deliver a url when the c# has finished creating the bloompub.
    //           //BloomPlayer recognizes "working" as a special value; it will show some spinner or some such.
    //           "working"
    // );

    //const pathToOutputBrowser = inStorybookMode ? "./" : "../../";

    const [path, setPath] = useState("");
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [progressOpen, setProgressOpen] = useState(false);
    const progress = useWatchString("Making PDF", "publish", "progress");
    const [progressTask, setProgressTask] = useState("MakingPdf");
    const [progressContent, setProgressContent] = useState<string[]>([]);
    const [percent, setPercent] = useState(0);
    useEffect(() => {
        console.log("progress is " + progress);
        const parts = progress.split("|");
        if (parts.length > 1) {
            console.log("opening progress dialog");
            setProgressOpen(true);
            if (progressTask !== parts[0]) {
                setProgressTask(parts[0]);
                setProgressContent([...progressContent, parts[0]]);
            }
            if (parts[1].startsWith("Percent: ")) {
                setPercent(
                    parseInt(parts[1].substring("Percent: ".length), 10)
                );
            }
        }
    }, [progress]);
    const progressHeader = useL10n("Progress", "Common.Progress");

    function onDocumentLoadSuccess({ numPages }) {
        setProgressOpen(false);
        setNumPages(numPages);
    }

    function onItemClick({ pageNumber: itemPageNumber }) {
        setPageNumber(itemPageNumber);
    }

    const mainPanel = (
        <React.Fragment>
            <PreviewPanel>
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={darkTheme}>
                        <Typography
                            css={css`
                                color: white;
                                align-self: center;
                            `}
                        >
                            {path ? (
                                <div>
                                    <Document
                                        css={css`
                                            display: flex;
                                        `}
                                        file={path}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                    >
                                        {/* <Outline
                                            onItemClick={({
                                                dest,
                                                pageIndex,
                                                pageNumber
                                            }) => setPageNumber(pageIndex)}
                                        /> */}
                                        <div
                                            css={css`
                                                margin-right: 15px;
                                                height: 435px;
                                                overflow-y: scroll;
                                                padding-right: 10px;
                                            `}
                                        >
                                            {Array.from(
                                                new Array(numPages),
                                                (el, index) => (
                                                    <Page
                                                        css={css`
                                                            ${index + 1 ===
                                                            pageNumber
                                                                ? "border: solid grey 5px;"
                                                                : "margin: 5px;margin-bottom: 10px;"}
                                                            border-radius: 2px;
                                                        `}
                                                        key={`page_${index +
                                                            1}`}
                                                        pageNumber={index + 1}
                                                        height={100}
                                                        onClick={() =>
                                                            setPageNumber(
                                                                index + 1
                                                            )
                                                        }
                                                    />
                                                )
                                            )}
                                        </div>
                                        <Page
                                            pageNumber={pageNumber}
                                            height={400}
                                        />
                                    </Document>
                                    {/* <p>
                                        Page {pageNumber} of {numPages} in{" "}
                                        {path}
                                    </p> */}
                                </div>
                            ) : (
                                "Click a button on the right to start creating PDF"
                            )}
                        </Typography>
                    </ThemeProvider>
                </StyledEngineProvider>
            </PreviewPanel>
            <UnderPreviewPanel
                css={css`
                    display: block;
                    flex-grow: 1;
                `}
            ></UnderPreviewPanel>
        </React.Fragment>
    );

    const optionsPanel = (
        <SettingsPanel>
            <PDFPrintFeaturesGroup
                onChange={() => {
                    props.onReset();
                }}
                onGotPdf={path => setPath(path)}
            />
            {/* push everything to the bottom */}
            <div
                css={css`
                    margin-top: auto;
                `}
            />
            <HelpGroup>
                <Typography>Not a real "HelpGroup"; needs changing</Typography>
                {/* Replace with links to PDF and Printing help
                <HelpLink
                    l10nKey="PublishTab.Android.AboutBloomPUB"
                    helpId="Tasks/Publish_tasks/Make_a_BloomPUB_file_overview.htm"
                >
                    About BloomPUB
                </HelpLink>
                */}
            </HelpGroup>
        </SettingsPanel>
    );

    const printButtonText = useL10n("Print...", "PublishTab.PrintButton");

    const saveButtonText = useL10n("Save PDF...", "PublishTab.SaveButton");

    const rightSideControls = (
        <React.Fragment>
            <Button onClick={() => {}}>
                <img src="./Print.png" />
                <div
                    css={css`
                        width: 0.5em;
                    `}
                />
                {printButtonText}
            </Button>
            <div
                css={css`
                    width: 1em;
                `}
            />
            <Button onClick={() => {}}>
                <img src="./Usb.png" />
                <div
                    css={css`
                        width: 0.5em;
                    `}
                />
                {saveButtonText}
            </Button>
        </React.Fragment>
    );

    return (
        <React.Fragment>
            <PublishScreenTemplate
                bannerTitleEnglish="Publish to PDF &amp; Print"
                bannerTitleL10nId="PublishTab.PdfPrint.BannerTitle"
                bannerRightSideControls={rightSideControls}
                optionsPanelContents={optionsPanel}
            >
                {mainPanel}
            </PublishScreenTemplate>
            <Dialog open={progressOpen}>
                <div
                    css={css`
                        height: 200px;
                        width: 300px;
                        position: relative;
                        padding: 10px;
                    `}
                >
                    <div
                        css={css`
                            position: absolute;
                            top: 0px;
                            right: 0px;
                        `}
                    >
                        <CircularProgress
                            variant="determinate"
                            value={percent}
                            size={40}
                            thickness={5}
                        />
                    </div>
                    <div>
                        <div
                            css={css`
                                font-weight: bold;
                                margin-bottom: 15px;
                            `}
                        >
                            {progressHeader}
                        </div>
                        {progressContent.map(s => (
                            <p
                                key={s}
                                css={css`
                                    margin: 0;
                                `}
                            >
                                {s}
                            </p>
                        ))}
                    </div>
                </div>
            </Dialog>
            {/* In storybook, there's no bloom backend to run the progress dialog */}
            {/* {inStorybookMode || (
                <PublishProgressDialog
                    heading={heading}
                    startApiEndpoint="publish/android/updatePreview"
                    webSocketClientContext="publish-android"
                    progressState={progressState}
                    setProgressState={setProgressState}
                    closePending={closePending}
                    setClosePending={setClosePending}
                    onUserStopped={() => {
                        postData("publish/android/usb/stop", {});
                        postData("publish/android/wifi/stop", {});
                        setClosePending(true);
                    }}
                />
            )} */}
        </React.Fragment>
    );
};

// a bit goofy... currently the html loads everything in pdf. So all the publish screens
// get any not-in-a-class code called, including ours. But it only makes sense to get wired up
// if that html has the root page we need.
if (document.getElementById("PdfPrintPublishScreen")) {
    ReactDOM.render(
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={lightTheme}>
                <PDFPrintPublishScreen />
            </ThemeProvider>
        </StyledEngineProvider>,
        document.getElementById("PdfPrintPublishScreen")
    );
}
