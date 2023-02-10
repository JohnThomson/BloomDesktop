/** @jsx jsx **/
import { jsx, css } from "@emotion/react";
import ReactDOM = require("react-dom");
import { Typography } from "@mui/material";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";

import { lightTheme } from "../../bloomMaterialUITheme";
import { Link } from "../../react_components/link";
import {
    PublishPanel,
    HelpGroup,
    SettingsPanel
} from "../commonPublish/PublishScreenBaseComponents";

import { LibraryPublishSteps } from "./LibraryPublishSteps";
import { PublishFeaturesGroup } from "../ReaderPublish/PublishFeaturesGroup";
import { LanguageGroup } from "../commonPublish/LanguageGroup";
import { AudioGroup } from "../commonPublish/AudioGroup";
import PublishScreenTemplate from "../commonPublish/PublishScreenTemplate";

export const LibraryPublishScreen = () => {
    const mainPanel = (
        <PublishPanel>
            <LibraryPublishSteps />
        </PublishPanel>
    );

    const settingsPanel = (
        <SettingsPanel>
            <AudioGroup />
            <LanguageGroup />
            <PublishFeaturesGroup />

            {/* push everything below this to the bottom */}
            <div
                css={css`
                    margin-top: auto;
                `}
            />
            <HelpGroup>
                {/* TODO, not designed yet */}
                <Link href="https://bloomLibrary.org/about" l10nKey={"TODO"}>
                    About BloomLibrary.org
                </Link>
            </HelpGroup>
        </SettingsPanel>
    );
    return (
        // I'm not actually sure why we want this Typography wrapper, but PublishAudioVideo has it,
        // and this is needed to keep the look consistent between the two screens.
        <Typography
            component={"div"}
            css={css`
                height: 100%;
            `}
        >
            <PublishScreenTemplate
                bannerTitleEnglish="Publish to Web"
                bannerTitleL10nId="PublishTab.Upload.BannerTitle"
                bannerDescriptionMarkdown="Let speakers find your books in [Bloom Reader](https://bloomlibrary.org/page/create/bloom-reader) and on [BloomLibrary.org](https://bloomlibrary.org/)"
                bannerDescriptionL10nId="PublishTab.Upload.BannerDescription"
                optionsPanelContents={settingsPanel}
                temporarilyDisableI18nWarning={true}
            >
                {mainPanel}
            </PublishScreenTemplate>
        </Typography>
    );
};
// a bit goofy... currently the html loads everything in publishUIBundlejs. So all the publish screens
// get any not-in-a-class code called, including ours. But it only makes sense to get wired up
// if that html has the root page we need.
if (document.getElementById("LibraryPublishScreen")) {
    ReactDOM.render(
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={lightTheme}>
                <LibraryPublishScreen />
            </ThemeProvider>
        </StyledEngineProvider>,
        document.getElementById("LibraryPublishScreen")
    );
}
