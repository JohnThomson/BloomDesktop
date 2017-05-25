import { ITabModel } from "../toolbox";
import { ToolBox } from "../toolbox";

export default class CartoonBubblesModel implements ITabModel {
    beginRestoreSettings(settings: string): JQueryPromise<void> {
        // Nothing to do, so return an already-resolved promise.
        var result = $.Deferred<void>();
        result.resolve();
        return result;
    }

    configureElements(container: HTMLElement) {
    }

    showTool() {
        // Review: does it matter that this is done each time we show?
        $("#prototype").draggable({ helper: "clone", containment: false });
    }

    hideTool() {
    }

    updateMarkup() {
    }

    name() { return 'cartoonBubbles'; }

    hasRestoredSettings: boolean;

    // Some things were impossible to do i18n on via the jade/pug
    // This gives us a hook to finish up the more difficult spots
    // So far unneeded in talkingBook
    finishTabPaneLocalization(paneDOM: HTMLElement) { }
}

ToolBox.getTabModels().push(new CartoonBubblesModel());
