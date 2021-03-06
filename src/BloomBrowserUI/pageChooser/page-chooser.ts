﻿///<reference path="../typings/axios/axios.d.ts"/>
/// <reference path="../lib/localizationManager/localizationManager.ts" />
import * as $ from 'jquery';
import * as jQuery from 'jquery';
import theOneLocalizationManager from '../lib/localizationManager/localizationManager';
import 'jquery-ui/jquery-ui-1.10.3.custom.min.js';
import axios = require('axios');

$(window).ready(() => {
    axios.get("/bloom/api/pageTemplates").then(result => {
        var templatesJSON = result.data;
        var pageChooser = new PageChooser(JSON.stringify(templatesJSON));
        pageChooser.loadPageGroups();
    })
        // If we don't catch axios errors we get mysterious JavaScript errors that just say "Error: Network Error".
        // I think they are something to do with the request completing after the dialog closes.
        // This catch might not be needed; I put them on all the axios requests.
        // The danger is that we might lose some error that does matter. I don't know how to distinguish.
        .catch(error => {
            console.log(error);
        });
});

// latest version of the expected JSON initialization string (from PageTemplatesApi.HandleTemplatesRequest)
// "{\"defaultPageToSelect\":\"(guid of template page)\",
//   \"orientation\":\"landscape\",
//   \"groups\":[{\"templateBookFolderUrl\":\"/bloom/localhost/C$/BloomDesktop/DistFiles/factoryGroups/Templates/Basic Book\",
//                     \"templateBookUrl\":\"/bloom/localhost/C$/BloomDesktop/DistFiles/factoryGroups/Templates/Basic Book/Basic Book.htm\"}]}"

class PageChooser {

    private _templateBookUrls: string;
    private _defaultPageToSelect: string;
    private _orientation: string;
    private _selectedGridItem: JQuery;
    private _indexOfPageToSelect: number;
    private _scrollingDiv: JQuery;
    private _scrollTopOfTheScrollingDiv: number;
    private _forChooseLayout: boolean;
    private _currentPageLayout: string;

    constructor(initializationJsonString: string) {
        var initializationObject;
        if (initializationJsonString) {
            try {
                initializationObject = $.parseJSON(initializationJsonString);
            } catch (e) {
                alert("Received bad JSON string: " + e);
                return;
            }
            this._templateBookUrls = initializationObject["groups"];
            this._defaultPageToSelect = initializationObject["defaultPageToSelect"];
            this._orientation = initializationObject["orientation"];
            this._currentPageLayout = initializationObject['currentLayout'];
            this._forChooseLayout = initializationObject['forChooseLayout'];
        } else {
            alert("Expected url in PageChooser ctor!");
        }

        this._selectedGridItem = undefined;
        this._indexOfPageToSelect = 0;
        this._scrollTopOfTheScrollingDiv = 0;
    }

    thumbnailClickHandler(clickedDiv, evt): void {
        // 'div' is an .invisibleThumbCover
        // Select new thumbnail
        var newsel = this.findProperElement(clickedDiv, evt);
        if (newsel == null)
            return;
        // Mark any previously selected thumbnail as no longer selected
        if (this._selectedGridItem != undefined) {
            $(this._selectedGridItem).removeClass("ui-selected");
        }
        this._selectedGridItem = newsel;
        $(this._selectedGridItem).addClass("ui-selected");

        // Display large preview
        var caption = $('#previewCaption');
        var defaultCaptionText = $(".gridItemCaption", this._selectedGridItem).text();
        this.setLocalizedText(caption, 'TemplateBooks.PageLabel.', defaultCaptionText);
        caption.attr("style", "display: block;");
        $("#preview").attr("src", $(this._selectedGridItem).find("img").first().attr("src"));
        this.setLocalizedText($('#previewDescriptionText'), 'TemplateBooks.PageDescription.', $(".pageDescription", this._selectedGridItem).text(), defaultCaptionText);
        if (this._forChooseLayout) {
            var willLoseData = this.willLoseData();
            if (willLoseData) {
                $('#mainContainer').addClass("willLoseData");
            } else {
                $('#mainContainer').removeClass("willLoseData");
            }
            $('#convertAnywayCheckbox').prop('checked', !willLoseData);
            this.continueCheckBoxChanged(); // possibly redundant
        }
    } // thumbnailClickHandler

    // Return true if choosing the current layout will cause loss of data
    willLoseData(): boolean {
        var selected = $(this._selectedGridItem);
        var selectedEditableDivs = parseInt(selected.attr('data-textDivCount'));
        var selectedPictures = parseInt(selected.attr('data-pictureCount'));

        var current = $((<HTMLIFrameElement>window.parent.document.getElementById('page')).contentWindow.document);
        var currentEditableDivs = current.find(".bloom-translationGroup:not(.box-header-off)").length;
        var currentPictures = current.find(".bloom-imageContainer").length;

        return selectedEditableDivs < currentEditableDivs || selectedPictures < currentPictures;
    }


    // There's a bug deep in javascript that doesn't take into account the scrolling
    // of a div element before something inside it is clicked on.  The following code
    // detects whether the scrolling has changed since the last mouse click, and if so,
    // searches for the item which should have matched.  For the initial bug report,
    // see https://silbloom.myjetbrains.com/youtrack/issue/BL-2623.
    // Note that the offset().top values returned by jquery properly take into account
    // the scrollTop of the scrolling parent div.  Which makes me think the bug may be
    // below the jquery level!?
    findProperElement(clickedDiv, evt): JQuery {
        var gridItem = $(clickedDiv).parent();
        if (evt) {
            var currentScrollTop = this._scrollingDiv.scrollTop();
            if (currentScrollTop !== this._scrollTopOfTheScrollingDiv) {
                // The scrolling position has changed, so we need to explicitly search
                // for the proper object.
                var y = evt["clientY"];     // retrieve the original click position
                var x = evt["clientX"];
                var container = $(clickedDiv).parent().parent();
                var childs = $(container).children();
                for (var i = 0; i < childs.length; ++i) {
                    var child = childs.eq(i);
                    var top = child.offset().top;
                    var bottom = top + child.height();
                    var left = child.offset().left;
                    var right = left + child.width();
                    if (top <= y && y <= bottom && left <= x && x <= right) {
                        // Remember the new scroll position and return the proper object.
                        this._scrollTopOfTheScrollingDiv = currentScrollTop;
                        return child;
                    }
                }
                // We couldn't find the proper object, so don't do anything.  The user
                // apparently clicked on a visually empty spot that got misidentified.
                return null;
            }
        }
        return gridItem;
    }


    // Set the text of the given element to the appropriate localization of defaultText
    // (or to defaultText, if no localization is available).
    // If defaultText is empty, set the element text to empty.
    // The localization ID to look up is made by concatenating the supplied prefix and the id
    // parameter, which defaults to the defaultText since we often use the English text of a
    // label as the last part of its ID.
    setLocalizedText(elt: JQuery, idPrefix: string, defaultText: string, id: string = defaultText) {
        if (defaultText) {
            theOneLocalizationManager.asyncGetText(idPrefix + id, defaultText)
                .done(translation => {
                    elt.text(translation);
                });
        } else {
            elt.text("");
        }
    }

    addPageClickHandler(): void {
        if (this._selectedGridItem == undefined || this._templateBookUrls == undefined) return;
        if (this._forChooseLayout && !$('#convertAnywayCheckbox').is(':checked')) return;

        const id = this._selectedGridItem.attr("data-pageId");
        const templateBookPath = this._selectedGridItem.closest(".group").attr("data-template-book-path");
        if (this._forChooseLayout) {
            axios.post("/bloom/api/changeLayout", { pageId: id, templateBookPath: templateBookPath }).catch(error => {
                // we seem to get unimportant errors here, possibly because the dialog gets closed before the post completes.
                console.log(error);
            });
        } else {
            axios.post("/bloom/api/addPage", { templateBookPath: templateBookPath, pageId: id }).catch(error => {
                console.log(error);
            });
        }
        // End the disabling of other panes for the modal dialog. The final argument is because in this
        // method the current window is the dialog, and it's the parent window's document that is being
        // monitored for this event.
        fireCSharpEvent("setModalStateEvent", "false", parent.window);
    }

    continueCheckBoxChanged(): void {
        if (!this._forChooseLayout) return;
        var cb = $('#convertAnywayCheckbox');
        $('#addPageButton').prop('disabled', !cb.is(':checked'));
    }

    // This is the starting-point method that is invoked to initialize the dialog.
    // At the point where it is called, the json parameters that control what will be displayed
    loadPageGroups(): void {
        // Save a reference to the scrolling div that contains the various page items.
        this._scrollingDiv = $(".gridItemDisplay", document);

        // Originally (now maybe YAGNI) the dialog handled more than one group of template pages.
        // Right now it only handles one, so the cloning of stub html is perhaps unnecessary,
        // but I've left it in case we need it later.

        // Save html sections that will get cloned later
        // there should only be one 'group' at this point; a stub with one default template page
        var groupHtml = $(".group", document).first().clone();
        // there should only be the one default 'gridItem' at this point
        var gridItemHtml = $(".gridItem", groupHtml).first().clone();
        if ($(this._templateBookUrls).length > 0) {
            // Remove original stub section
            $(".outerGroupContainer", document).empty();
            this.loadNextPageGroup(this._templateBookUrls, groupHtml, gridItemHtml, this._defaultPageToSelect);
        }
        $("#addPageButton", document).button().click(() => {
            this.addPageClickHandler();
        });
        $("#convertAnywayCheckbox", document).button().change(() => {
            this.continueCheckBoxChanged();
        });
        var pageButton = $("#addPageButton", document);
        var okButtonLabelId = 'EditTab.AddPageDialog.AddThisPageButton';
        var okButtonLabelText = 'Add This Page';

        if (this._forChooseLayout) {
            okButtonLabelId = 'EditTab.AddPageDialog.ChooseLayoutButton';
            okButtonLabelText = 'Use This Layout';
            this.setLocalizedText($('#convertAnywayCheckbox'), 'EditTab.AddPageDialog.', 'Continue anyway', 'ChooseLayoutContinueCheckbox')
            this.setLocalizedText($('#convertLosesMaterial'), 'EditTab.AddPageDialog.', 'Converting to this layout will cause some content to be lost.', 'ChooseLayoutWillLoseData')
        }
        theOneLocalizationManager.asyncGetText(okButtonLabelId, okButtonLabelText)
            .done(translation => {
                pageButton.attr('value', translation);
            });

        if (this._orientation === 'landscape') {
            $("#mainContainer").addClass("landscape");
        }
    } // loadPageGroups


    // This pops one template book order from the queue, does the async get,
    // loads it in the dialog, then recursively goes back for another.
    // Doing one at a time does two things for us. First, it makes the
    // books get added in the order we want (which we couldn't control if we ask for them all
    // at once). Secondly, it ensures we get the most important template pages shown and ready
    // to use as quickly as possible.
    loadNextPageGroup(queue, groupHTML, gridItemHTML, defaultPageToSelect: string): void {
        var order = queue.shift();
        if (!order)
            return; // no more to get
        axios.get("/bloom/" + order.templateBookPath).then(result => {
            var pageData = result.data;

            // Grab all pages in this group
            // N.B. normal selector syntax or .find() WON'T work here because pageData is not yet part of the DOM!
            // Creating a jquery object via $(pageData) causes any img elements in the html string to be dereferenced,
            // which can cause the Bloom server to complain about not finding files of the form "pageChooser/read.png".
            // So we must remove the img elements from the returned string before the conversion to a jquery object.
            // Note that none of the img elements in the template file are needed at this point for laying out the
            // Add Page dialog, or for creating thumbnails, so it's safe to delete them.  See
            // https://silbloom.myjetbrains.com/youtrack/issue/BL-3819 for details of the symptoms experienced when
            // running Bloom without this ugly hack.
            var pageNoImg = (<string>pageData).replace(/<img[^>]*><\/img>/g, "");
            var pages = $(pageNoImg).filter('.bloom-page[id]').filter('[data-page="extra"]');

            if (pages.length == 0) {
                console.log("Could not find any template pages in " + order.templateBookPath);
                //don't add a group for books that don't have template pages; just move on.
                // (This will always be true for a newly created template.)
                this.loadNextPageGroup(queue, groupHTML, gridItemHTML, defaultPageToSelect);
                return; // suppress adding this group.
            }

            var dataBookArray = $("div[data-book='bookTitle']", pageNoImg);
            var groupTitle = $(dataBookArray.first()).text();
            // Add title and container to dialog
            var groupToAdd = $(groupHTML).clone();
            groupToAdd.attr("data-template-book-path", order.templateBookPath);
            this.setLocalizedText($(groupToAdd).find(".groupCaption"), 'TemplateBooks.BookName.', groupTitle);
            $(".outerGroupContainer", document).append(groupToAdd);

            if (this._forChooseLayout) {
                // This filters out the (empty) custom page, which is currently never a useful layout change, since all data would be lost.
                pages = pages.not('.bloom-page[id="5dcd48df-e9ab-4a07-afd4-6a24d0398386"]');
            }
            //console.log("loadPageFromGroup("+order.templateBookFolderUrl+")");
            this.loadPageFromGroup(groupToAdd, pages, gridItemHTML, order.templateBookFolderUrl, defaultPageToSelect);

            this.thumbnailClickHandler($(".invisibleThumbCover").eq(this._indexOfPageToSelect), null);

            this.loadNextPageGroup(queue, groupHTML, gridItemHTML, defaultPageToSelect);

        }).catch(e => {
            //we don't really want to let one bad template keep us from showing others.
            // Insert a message into the dialog
            var path = order.templateBookPath;
            var index = path.lastIndexOf("/");
            var templateName = path.substring(index + 1, path.length);
            var templateTitle = templateName.replace(".html", "");
            var groupToAdd = $(groupHTML).clone();
            this.setLocalizedText($(groupToAdd).find(".groupCaption"), 'TemplateBooks.BookName.', templateTitle);
            var innerGroup = groupToAdd.find(".innerGroupContainer");
            innerGroup.remove();
            groupToAdd.append("<div id='missingMsg'/>")
            theOneLocalizationManager.asyncGetText('EditPage.AddPageDialog.NoTemplate', "Could not find {0}")
                .done(translation => {
                    groupToAdd.find("#missingMsg").text(translation.replace("{0}", templateName));
                });
            $(".outerGroupContainer", document).append(groupToAdd);

            this.loadNextPageGroup(queue, groupHTML, gridItemHTML, defaultPageToSelect)
        });
    }


    loadPageFromGroup(currentGroup, pageArray, gridItemTemplate, templateBookFolderUrl, defaultPageToSelect: string) {
        if ($(pageArray).length < 1) {
            console.log("pageArray empty for " + templateBookFolderUrl);
            return 0;
        }

        // Remove default template page
        $(".innerGroupContainer", currentGroup).empty();

        var indexToSelect = -1;
        // insert a template page for each page with the correct #id on the url
        $(pageArray).each((index, div) => {

            if ($(div).attr("data-page") === "singleton")
                return;// skip this one

            var currentGridItemHtml = $(gridItemTemplate).clone();

            var currentId = $(div).attr("id");
            $(currentGridItemHtml).attr("data-pageId", currentId);
            $(currentGridItemHtml).attr("data-textDivCount", $(div).find(".bloom-translationGroup:not(.box-header-off)").length);
            $(currentGridItemHtml).attr("data-pictureCount", $(div).find(".bloom-imageContainer").length);

            // The check for _indexOfPageToSelect here keeps the selection on the *first* matching page. In BL-4500, we found
            // that different templates could reuse the same guid for custom page. That's a problem probably should be
            // sorted out, but it's out "in the wild" in the Story Primer, so we have to have a fix that doesn't depend
            // on what templates the user has installed.
            if (currentId === defaultPageToSelect && this._indexOfPageToSelect == 0)
                this._indexOfPageToSelect = index;

            var pageDescription = $(".pageDescription", div).first().text();
            $(".pageDescription", currentGridItemHtml).first().text(pageDescription);

            var pageLabel = $(".pageLabel", div).first().text().trim();
            $(".gridItemCaption", currentGridItemHtml).first().text(pageLabel);

            var possibleImageUrl = this.getPossibleImageUrl(templateBookFolderUrl, pageLabel);
            $("img", currentGridItemHtml).attr("src", possibleImageUrl);

            $(".innerGroupContainer", currentGroup).append(currentGridItemHtml);
        }); // each
        // once the template pages are installed, attach click handler to them.
        $(".invisibleThumbCover", currentGroup).each((index, div) => {
            $(div).dblclick(() => {
                this.addPageClickHandler();
            }); // invisibleThumbCover double click

            $(div).click((evt) => {
                this.thumbnailClickHandler(div, evt);
            }); // invisibleThumbCover click
        }); // each
    } // loadPageFromGroup


    getPossibleImageUrl(templateBookFolderUrl: string, pageLabel: string): string {
        var label = pageLabel.replace("&", "+"); //ampersands confuse the url system
        // The result may actually be a png file or an svg, and there may be some delay while the png is generated.

        //NB:  without the generateThumbnaiIfNecessary=true, we can run out of worker threads and get deadlocked.
        //See EnhancedImageServer.IsRecursiveRequestContext
        return "/bloom/api/pageTemplateThumbnail/" + templateBookFolderUrl + '/template/' + label +
            (this._orientation === "landscape" ? "-landscape" : "") + ".svg?generateThumbnaiIfNecessary=true";
    }
} // End OF PageChooserClass

// Confusingly, this function is not used by the HTML that primarily loads the JS built from this
// file (the pageChooserBundle, loaded by page-chooser-main.pug). Instead, it is imported into
// the editViewFrame and exported from there so it can be invoked directly from C#, in the context of
// the editable page, to fire off the whole process of launching the dialog which contains an iframe
// whose source loads this file. (Is there a better place for this function? It is nice to have it
// with the rest of the page-chooser code, except for the problem of belonging to the parent frame.)
// NB: this function does not have access to the PageChooser object which will eventually be created and called
// in the context of the ready function for the dialog iframe content window.
export function showAddPageDialog(forChooseLayout: boolean) {
    var theDialog;

    //reviewSlog. I don't see why the localiationManager should live on the page. Where stuff is equally relevant to all frames,
    //it should if anything belong to the root frmate (this one)
    //var parentElement = (<any>document.getElementById('page')).contentWindow;
    //var lm = parentElement.localizationManager;

    // don't show if a dialog already exists
    if ($(document).find(".ui-dialog").length) {
        return;
    }

    var key = 'EditTab.AddPageDialog.Title';
    var english = 'Add Page...';

    if (forChooseLayout) {
        key = 'EditTab.AddPageDialog.ChooseLayoutTitle';
        english = 'Choose Different Layout...';
    }

    theOneLocalizationManager.asyncGetText(key, english).done(title => {
        var dialogContents = CreateAddPageDiv();

        theDialog = $(dialogContents).dialog({
            //reviewslog Typescript didn't like this class: "addPageDialog",
            autoOpen: false,
            resizable: false,
            modal: true,
            width: 795,
            height: 550,
            position: {
                my: "left bottom", at: "left bottom", of: window
            },
            title: title,
            close: function () {
                $(this).remove();
                fireCSharpEvent('setModalStateEvent', 'false');
            },
        });

        //TODO:  this doesn't work yet. We need to make it work, and then make it localizationManager.asyncGetText(...).done(translation => { do the insertion into the dialog });
        // theDialog.find('.ui-dialog-buttonpane').prepend("<div id='hint'>You can press ctrl+N to add the same page again, without opening this dialog.</div>");

        jQuery(document).on('click', 'body > .ui-widget-overlay', function () {
            $(".ui-dialog-titlebar-close").trigger('click');
            return false;
        });
        fireCSharpEvent('setModalStateEvent', 'true');
        theDialog.dialog('open');

        //parentElement.$.notify("testing notify",{});
    });
}

// "region" Add Page dialog
function CreateAddPageDiv() {
    var dialogContents = $('<div id="addPageConfig"/>').appendTo($('body'));

    // For some reason when the height is 100% we get an unwanted scroll bar on the far right.
    var html = "<iframe id=\"addPage_frame\" src=\"/bloom/pageChooser/page-chooser-main.html\" scrolling=\"no\" style=\"width: 100%; height: 99%; border: none; margin: 0\"></iframe>";
    dialogContents.append(html);
    return dialogContents;
}
// "endregion" Add Page dialog


/**
 * Fires an event for C# to handle
 * @param {String} eventName
 * @param {String} eventData
 * @param {boolean} dispatchWindow if not null, use this window's document to dispatch the event
 */
// Enhance: JT notes that this method pops up from time to time; can we consolidate?
function fireCSharpEvent(eventName, eventData, dispatchWindow?: Window) {
    var event = new MessageEvent(eventName, {/*'view' : window,*/ 'bubbles': true, 'cancelable': true, 'data': eventData });
    if (dispatchWindow) {
        dispatchWindow.document.dispatchEvent(event);
    } else {
        document.dispatchEvent(event);
    }
    // For when we someday change this file to TypeScript... since the above ctor is not declared anywhere.
    // Solution III (works)
    //var event = new (<any>MessageEvent)(eventName, { 'view': window, 'bubbles': true, 'cancelable': true, 'data': eventData });
}
