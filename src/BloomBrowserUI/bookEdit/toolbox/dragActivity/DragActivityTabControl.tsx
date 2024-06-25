import { jsx, css, ThemeProvider } from "@emotion/react";
import * as React from "react";
import { toolboxTheme } from "../../../bloomMaterialUITheme";
import { DragActivityTool, Tabs } from "./dragActivityTool";
import ReactDOM = require("react-dom");
import { getToolboxBundleExports } from "../../js/bloomFrames";

// This component is responsible for the Game Setup mode tabs in the Drag Activity tool.
// Although the code seems to belong in this folder with the other drag activity code, it is actually
// not part of the toolbox, since its component is part of the editable page iframe.
// Something weird seems to happen if we render an element there using the toolbox copy of
// ReactDOM.Render, so we go to some trouble to make the renderDragActivityTabControl be a function
// that the editable page iframe exports and to call it through getEditablePageBundleExports().

export const DragActivityTabControl: React.FunctionComponent<{
    activeTab: number;
}> = props => {
    const changeHandler = (tab: number) => {
        getToolboxBundleExports()?.setActiveDragActivityTab(tab);
    };
    return (
        <ThemeProvider theme={toolboxTheme}>
            <div
                css={css`
                    display: flex;
                    // The mockup seems to have this a little dimmer than white, but I haven't found an existing constant
                    // that seems appropriate. This will do for a first approximation.
                    color: lightgray;
                `}
            >
                <div
                    css={css`
                        margin-top: 8px;
                        margin-right: 20px;
                    `}
                >
                    Game Setup mode:
                </div>
                <Tabs
                    value={props.activeTab}
                    onChange={changeHandler}
                    labels={
                        [
                            "Start",
                            "Correct",
                            "Wrong",
                            "Play"
                        ] /* Todo: localize*/
                    }
                />
            </div>
        </ThemeProvider>
    );
};

export function renderDragActivityTabControl(currentTab: number) {
    const page = DragActivityTool.getBloomPage();
    const root = page?.ownerDocument.getElementById(
        "drag-activity-tab-control"
    );
    if (!root) {
        // not created yet, try later
        setTimeout(() => renderDragActivityTabControl(currentTab), 200);
        return;
    }
    ReactDOM.render(<DragActivityTabControl activeTab={currentTab} />, root);
}
