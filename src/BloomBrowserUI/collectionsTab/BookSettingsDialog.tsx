/** @jsx jsx **/
import { jsx, css } from "@emotion/core";

import * as React from "react";
import { useL10n } from "../react_components/l10nHooks";
import BloomButton from "../react_components/bloomButton";
import { BloomApi } from "../utils/bloomApi";
import {
    BloomDialog,
    DialogMiddle,
    DialogBottomButtons,
    DialogBottomLeftButtons,
    DialogTitle,
    IBloomDialogProps
} from "../react_components/BloomDialog/BloomDialog";
import {
    DialogCancelButton,
    DialogFolderChooser,
    WarningBox
} from "../react_components/BloomDialog/commonDialogComponents";

import { ExperimentalBadge } from "../react_components/experimentalBadge";
import { useEventLaunchedBloomDialog } from "../react_components/BloomDialog/BloomDialogPlumbing";
// Todo: when config-r is properly packaged and shipping, we should be able to just import all these from config-r.
import {
    ConfigrPane,
    ConfigrGroup,
    ConfigrSubgroup,
    ConfigrInput,
    ConfigrBoolean
} from "config-r";
//import { ConfigrPane } from "../node_modules/config-r/lib/ConfigrPane";
// import {
//     ConfigrGroup,
//     ConfigrSubgroup,
//     ConfigrInput,
//     ConfigrBoolean
// } from "../node_modules/config-r/lib/ContentPane";

export const BookSettingsDialogLauncher: React.FunctionComponent<{}> = () => {
    const {
        openingEvent,
        closeDialog,
        propsForBloomDialog
    } = useEventLaunchedBloomDialog("BookSettingsDialog");

    // We extract the core here so that we can avoid running most of the hook code when this dialog is not visible.
    return propsForBloomDialog.open ? (
        <BookSettingsDialog
            closeDialog={closeDialog}
            propsForBloomDialog={propsForBloomDialog}
            initialValues={openingEvent.initialValues}
        />
    ) : null;
};

interface coverSettings {
    coverColor: string;
}

interface marginSettings {
    marginTop: string;
    marginBottom: string;
    marginOuter: string;
    marginInner: string;
}

interface sizeSettings {
    width: number;
    height: number;
}

interface otherSettings {
    showPageNumber: boolean;
    theme: string;
}

interface appearanceSettings {
    cover: coverSettings;
    margins: marginSettings;
    maxImageSize: sizeSettings;
    other: otherSettings;
}

interface bookSettings {
    appearance: appearanceSettings;
}

const BookSettingsDialog: React.FunctionComponent<{
    closeDialog: () => void;
    propsForBloomDialog: IBloomDialogProps;
    initialValues: bookSettings;
}> = props => {
    return (
        <BloomDialog {...props.propsForBloomDialog}>
            <DialogTitle title="Book Settings">
                <ExperimentalBadge />
            </DialogTitle>
            <DialogMiddle
                css={css`
                    white-space: pre;
                `}
            >
                <ConfigrPane
                    label="Book Settings"
                    //initialValues={props.initialValues}
                    //themeOverrides={bloomThemeOverrides}
                    showSearch={false}
                    {...props}
                >
                    <ConfigrGroup
                        label=""
                        level={1}
                        // This should have a label, "Appearance", when there is more than one ConfigrGroup.
                        // While there is not, it just takes up space and confuses things.
                    >
                        <ConfigrSubgroup label="Cover" path="appearance.cover">
                            <ConfigrInput
                                path={`appearance.cover.coverColor`}
                                label="Cover Color"
                            />
                        </ConfigrSubgroup>
                        <ConfigrSubgroup
                            label="Margins"
                            path="appearance.margins"
                        >
                            <ConfigrInput
                                path={`appearance.margins.marginTop`}
                                // wants a way to say it can be mm, or in, or pt, or...
                                label="Top"
                            />
                            <ConfigrInput
                                path={`appearance.margins.marginBottom`}
                                label="Bottom"
                            />
                            <ConfigrInput
                                path={`appearance.margins.marginOuter`}
                                label="Outer"
                            />
                            <ConfigrInput
                                path={`appearance.margins.marginInner`}
                                label="Inner"
                            />
                        </ConfigrSubgroup>
                        <ConfigrSubgroup
                            label="Max Image Size"
                            path="appearance.maxImageSize"
                        >
                            <ConfigrInput
                                path={`appearance.maxImageSize.width`}
                                label="Width"
                                // Wants validation to be a positive number, possibly with an upper limit...2000? 5000?
                            />
                            <ConfigrInput
                                path={`appearance.maxImageSize.height`}
                                label="Height"
                            />
                        </ConfigrSubgroup>
                        <ConfigrSubgroup label="Other" path="appearance.other">
                            <ConfigrBoolean
                                label="Show Page Numbers"
                                path="appearance.other.showPageNumber"
                            />
                            <ConfigrInput
                                path={`appearance.other.theme`}
                                label="Theme"
                                // Review: is this meant to be a place where the user can enter an arbitrary CSS file name?
                                // Or are we thinking of providing a fixed set of built-in themes he can choose from, so
                                // this should be a select?
                            />
                        </ConfigrSubgroup>
                    </ConfigrGroup>
                </ConfigrPane>
            </DialogMiddle>
            <DialogBottomButtons>
                <DialogBottomLeftButtons>
                    {/* Currently we don't really have any help for this.

                    <HelpLink
                        helpId="Tasks/Basic_tasks/Export_to_Spreadsheet.htm"
                        l10nKey="Common.Help"
                    >
                        Help
                    </HelpLink> */}
                </DialogBottomLeftButtons>
                <BloomButton
                    enabled={true}
                    variant="contained"
                    l10nKey="Common.OK"
                    hasText={true}
                    size="medium"
                    onClick={() => {
                        // BloomApi.postData("bookCommand/updateSettings", {
                        //     parentFolderPath: folderPath
                        // });
                        props.closeDialog();
                    }}
                >
                    OK
                </BloomButton>
                <DialogCancelButton onClick={props.closeDialog} />
            </DialogBottomButtons>
        </BloomDialog>
    );
};
