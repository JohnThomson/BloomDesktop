import * as React from "react";
import { useLayoutEffect } from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import { BloomApi } from "../../utils/bloomApi";
import DialogActions from "@material-ui/core/DialogActions";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import { useTheme } from "@material-ui/styles";
import "./ProgressDialog.less";

export enum ProgressState {
    Closed,
    Working, // doing something that will lead to a "Done"
    Done,
    Serving // doing something indefinitely, which user can stop
}

export const ProgressDialog: React.FunctionComponent<{
    heading?: string;
    progressMessages: string;
    progressState: ProgressState;
    errorEncountered?: boolean; // do something visual to indicate there was a problem
    onUserClosed: () => void;
    onUserStopped: () => void;
    onUserCanceled: () => void;
}> = props => {
    const messagesDivRef = React.useRef<HTMLDivElement>(null);
    const messageEndRef = React.useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const onCopy = () => {
        // document.execCommand("copy") does not work in Bloom's geckofx.
        BloomApi.postDataWithConfig(
            "publish/android/textToClipboard",
            messagesDivRef.current!.innerText,
            { headers: { "Content-Type": "text/plain" } }
        );
    };
    //React.useEffect(() => alert("constructing ProgressDialog"), []);
    const somethingStillGoing =
        props.progressState == ProgressState.Working ||
        props.progressState == ProgressState.Serving;

    // every time there are new messages, scroll to the bottom by scrolling into view
    // an empty element that is always at the end.
    useLayoutEffect(() => {
        window.setTimeout(() => {
            if (messageEndRef.current) {
                messageEndRef.current!.scrollIntoView();
            }
        }, 100);
    }, [props.progressMessages]); // do this every time the message text changes

    return (
        <Dialog
            className="progressDialog"
            open={props.progressState !== ProgressState.Closed}
            onBackdropClick={() => {
                // allow just clicking out of the dialog to close, unless we're still working,
                // in which case you have to go and click on "CANCEL" or "Stop Sharing"
                if (!somethingStillGoing) {
                    props.onUserClosed();
                }
            }}
        >
            <DialogTitle
                style={
                    props.errorEncountered
                        ? {
                              backgroundColor: (theme as any).palette.warning
                                  .main
                          }
                        : {}
                }
            >
                {props.heading || "Progress"}
            </DialogTitle>
            <DialogContent style={{ width: "500px", height: "300px" }}>
                <Typography>
                    <div
                        ref={messagesDivRef}
                        dangerouslySetInnerHTML={{
                            __html: props.progressMessages
                        }}
                    />
                </Typography>
                <div ref={messageEndRef} />
            </DialogContent>
            <DialogActions>
                {somethingStillGoing || (
                    <Button
                        onClick={() => onCopy()}
                        color="secondary"
                        style={{ marginRight: "auto" }}
                    >
                        Copy to Clipboard
                    </Button>
                )}

                {(() => {
                    switch (props.progressState) {
                        case ProgressState.Serving:
                            return (
                                <Button
                                    onClick={props.onUserStopped}
                                    color="primary"
                                    variant="contained"
                                >
                                    Stop Sharing
                                </Button>
                            );

                        case ProgressState.Working:
                            return null;
                        /* eventually we'll want this, but at the moment, we only use this state
                                    for making previews, and in that state Bloom doesn't have a way of
                                    cancelling.
                                <Button
                                    onClick={props.onUserCanceled}
                                    color="primary"
                                >
                                    Cancel
                                </Button>*/
                        case ProgressState.Done:
                            return (
                                <Button
                                    variant="contained"
                                    onClick={props.onUserClosed}
                                    color="primary"
                                >
                                    Close
                                </Button>
                            );
                        case ProgressState.Closed:
                            return null;
                    }
                })()}
            </DialogActions>
        </Dialog>
    );
};
