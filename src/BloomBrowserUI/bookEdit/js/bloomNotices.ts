/// <reference path="../../lib/jquery.d.ts" />
/// <reference path="../../lib/localizationManager/localizationManager.ts" />
/// <reference path="bloomQtipUtils.ts" />

interface qtipInterface extends JQuery {
    qtip(options: any): JQuery;
    qtipSecondary(options: any): JQuery;
}

class bloomNotices {
    public static addExperimentalNotice(container: HTMLElement): void {
        $(container).find(".pictureDictionaryPage").each(function () {
            (<qtipInterface>$(this)).qtipSecondary({
                content: "<div id='experimentNotice'><img src='/bloom/images/experiment.png'/>This page is an experimental prototype which may have many problems, for which we apologize.<div/>"
                , show: { ready: true }
                , hide: false
                , position: { at: 'right top',
                    my: 'left top'
                },
                style: { classes: 'ui-tooltip-red',
                    tip: { corner: false }
                }
            });
        });
    }

    public static addEditingNotAllowedMessages(container: HTMLElement): void {
        $(container).find('*[data-hint]').each(function () {

            if ($(this).css('cursor') == 'not-allowed') {
                var whyDisabled = "You cannot change these because this is not the original copy.";
                if ($(this).hasClass('bloom-readOnlyInEditMode')) {
                    whyDisabled = "You cannot put anything in there while making an original book.";
                }

                var whatToSay = $(this).attr("data-hint");//don't use .data(), as that will trip over any } in the hint and try to interpret it as json

                whatToSay = localizationManager.getLocalizedHint(whatToSay, $(this)) + " <br/>" + whyDisabled;
                var theClasses = 'ui-tooltip-shadow ui-tooltip-red';
                var pos = { at: 'right center',
                    my: 'left center'
                };
                (<qtipInterface>$(this)).qtip({
                    content: whatToSay,
                    position: pos,
                    show: {
                        event: 'focusin mouseenter'
                    },
                    style: {
                        classes: theClasses
                    }
                });
            }
        });
    }
}