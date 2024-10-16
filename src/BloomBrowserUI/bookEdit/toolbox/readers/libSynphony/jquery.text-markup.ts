/**
 * jquery.text-markup.js
 *
 * Marking text according to various rules
 *
 * Created Apr 24, 2014 by Phil Hopper
 *
 */

import * as _ from 'underscore';
import { theOneLibSynphony, LibSynphony } from './synphony_lib';
import './bloomSynphonyExtensions.js'; //add several functions to LanguageData

/**
 * Use an 'Immediately Invoked Function Expression' to make this compatible with jQuery.noConflict().
 * @param {jQuery} $
 */
(function ($) {

    var cssSentenceTooLong = 'sentence-too-long';
    var cssSightWord = 'sight-word';
    var cssWordNotFound = 'word-not-found';
    var cssPossibleWord = 'possible-word';
    var cssDesiredGrapheme = 'desired-grapheme';
    var cssTooManyWordsOnPage = 'page-too-many-words';

    /**
     * Checks the innerHTML of an HTML entity (div) using the selected options
     * @param {Object} options
     * @returns {Object}
     */
    $.fn.checkLeveledReader = function (options) {

        var allWords = '';

        var opts = $.extend({ maxWordsPerSentence: 999, maxWordsPerPage: 9999 }, options);

        // remove previous synphony markup
        this.removeSynphonyMarkup();

        // initialize words per page
        var totalWordCount = 0;

        var checkLeaf = function (leaf) {
            stashNonTextUIElementsInEditBox(leaf);
            // split into sentences
            var fragments = theOneLibSynphony.stringToSentences($(leaf).html());
            var newHtml = '';

            for (var i = 0; i < fragments.length; i++) {

                var fragment = fragments[i];

                if (fragment.isSpace) {

                    // this is inter-sentence space
                    newHtml += fragment.text;
                    allWords += ' ';
                }
                else {

                    var sentenceWordCount = fragment.wordCount();
                    totalWordCount += sentenceWordCount;
                    allWords += fragment.text;

                    // check sentence length
                    if (sentenceWordCount > opts.maxWordsPerSentence) {

                        // tag sentence as having too many words
                        newHtml += '<span class="' + cssSentenceTooLong + '" data-segment="sentence">' + fragment.text + '</span>';
                    }
                    else {

                        // nothing to see here
                        newHtml += fragment.text;
                    }
                }
            }

            // If this element represents a paragraph, then the overall page text needs a paragraph break here.
            if (leaf.tagName === "P") {
                allWords += "\r\n";
            }

            // set the html
            $(leaf).html(newHtml);
            restoreNonTextUIElementsInEditBox(leaf);
        };

        var checkRoot = function (root) {
            var children = root.children();
            var processedChild = false; // Did we find a significant child?
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var name = child.nodeName.toLowerCase();
                // Review: is there a better way to pick out the elements that can occur within content elements?
                if (name != 'span' && name != 'br' && name != 'i' && name != 'b' && name != 'u') {
                    processedChild = true;
                    checkRoot($(child));
                }
            }
            if (!processedChild) // root is a leaf; process its actual content
                checkLeaf(root.get(0));
            // Review: is there a need to handle elements that contain both sentence text AND child elements with their own text?
        };

        this.each(function () { checkRoot($(this)); });

        // check words per page
        if (totalWordCount > opts.maxWordsPerPage) {

            var page = parent.window.document.getElementById('page') as HTMLIFrameElement;
            if (!page)
                $('body').find('div.bloom-page').addClass(cssTooManyWordsOnPage);
            else
                $('body', page.contentWindow.document).find('div.bloom-page').addClass(cssTooManyWordsOnPage);
        }

        this['allWords'] = allWords;
        return this;
    };

    /**
     * Checks the innerHTML of an HTML entity (div) using the selected options
     * @param {Object} options
     * @returns {Object}
     */
    $.fn.checkDecodableReader = function (options) {

        var opts = $.extend({ focusWords: [], previousWords: [], sightWords: [], knownGraphemes: [] }, options);
        var text = '';

        // remove previous synphony markup
        this.removeSynphonyMarkup();

        // get all text
        this.each(function () {
            text += ' ' + removeAllMarkup($(this).html());
        });

        /**
         * @type StoryCheckResults
         */
        var results = theOneLibSynphony.checkStory(opts.focusWords, opts.previousWords, opts.knownGraphemes, text, opts.sightWords.join(' '));

        // markup
        this.each(function () {
            stashNonTextUIElementsInEditBox(this);
            var html = $(this).html();

            // ignore empty elements
            if ((html.trim().length > 0) && (text.trim().length > 0)) {
                html = theOneLibSynphony.wrap_words_extra(html, results.sight_words, cssSightWord, ' data-segment="word"');
                html = theOneLibSynphony.wrap_words_extra(html, results.possible_words, cssPossibleWord, ' data-segment="word"');

                // remove numbers from list of bad words
                var notFound = _.difference(results.remaining_words, results.getNumbers());

                html = theOneLibSynphony.wrap_words_extra(html, notFound, cssWordNotFound, ' data-segment="word"');
                $(this).html(html);
            }
            restoreNonTextUIElementsInEditBox(this);
        });

        return this;
    };

    /**
     * Finds the maximum word count in the selected sentences.
     * @returns {int}
     */
    $.fn.getMaxSentenceLength = function () {

        var maxWords = 0;

        this.each(function () {

            // split into sentences
            var fragments = theOneLibSynphony.stringToSentences(removeAllMarkup($(this).html()));

            if ((!fragments) || (fragments.length === 0)) return;

            // remove inter-sentence space
            fragments = fragments.filter(function (frag) {
                return frag.isSentence;
            });

            var subMax = Math.max.apply(Math, fragments.map(function (frag) {
                return frag.wordCount();
            }));

            if (subMax > maxWords) maxWords = subMax;
        });

        return maxWords;
    };

    /**
     * Returns the count of all words in the selected elements.
     * @returns {int}
     */
    $.fn.getTotalWordCount = function () {

        var wordCount = 0;

        this.each(function () {

            // split into sentences
            var fragments = theOneLibSynphony.stringToSentences(removeAllMarkup($(this).html()));

            // remove inter-sentence space
            fragments = fragments.filter(function (frag) {
                return frag.isSentence;
            });

            // sum of word counts
            for (var i = 0; i < fragments.length; i++)
                wordCount += fragments[i].wordCount();
        });

        return wordCount;
    };

    /**
     * Removes all the markup that was inserted by this addin
     */
    $.fn.removeSynphonyMarkup = function () {

        this.each(function () {

            // remove markup for deleted text
            $(this).find('span[data-segment=sentence]:empty').remove();
            $(this).find('span[data-segment=word]:empty').remove();
            $(this).find('span[data-segment=grapheme]:empty').remove();

            // remove previous sentence markup
            $(this).find('span[data-segment=sentence]').contents().unwrap();
            $(this).find('span[data-segment=word]').contents().unwrap();
            $(this).find('span[data-segment=grapheme]').contents().unwrap();
        });

        // remove page markup
        var page = parent.window.document.getElementById('page') as HTMLIFrameElement;
        if (!page)
            $('body').find('div.' + cssTooManyWordsOnPage).removeClass(cssTooManyWordsOnPage);
        else
            $('body', page.contentWindow.document).find('div.' + cssTooManyWordsOnPage).removeClass(cssTooManyWordsOnPage);
    };


    $.extend({
        /**
         * Highlights selected graphemes in a word
         * @param {String} word
         * @param {String[]} gpcForm
         * @param {String[]} desiredGPCs
         * @returns {String}
         */
        markupGraphemes: function (word, gpcForm, desiredGPCs) {

            // for backward compatibility
            if (Array.isArray(word))
                return oldMarkup(word, gpcForm);

            var returnVal = '';

            // loop through GPCForm
            for (var i = 0; i < gpcForm.length; i++) {

                var offset = gpcForm[i].length;
                var chars = word.substr(0, offset);

                if (desiredGPCs.indexOf(gpcForm[i]) > -1)
                    returnVal += '<span class="' + cssDesiredGrapheme + '" data-segment="grapheme">' + chars + '</span>';
                else
                    returnVal += chars;

                word = word.slice(offset);
            }

            return returnVal;
        }
    });

    $.extend({ cssSentenceTooLong: function () { return cssSentenceTooLong; } });
    $.extend({ cssSightWord: function () { return cssSightWord; } });
    $.extend({ cssWordNotFound: function () { return cssWordNotFound; } });
    $.extend({ cssPossibleWord: function () { return cssPossibleWord; } });

    /**
     * Strips all html from the input string
     * @param {String} textHTML
     * @returns {String}
     */
    function removeAllMarkup(textHTML) {

        // preserve spaces after line breaks and paragraph breaks
        var regex = /(<br><\/br>|<br>|<br \/>|<br\/>|<p><\/p>|<p>|<p \/>|<p\/>|\n)/g;
        textHTML = textHTML.replace(regex, ' ');

        return $('<div>' + textHTML + '</div>').text();
    }

    function oldMarkup(gpcForm, desiredGPCs) {

        var returnVal = '';

        // loop through GPCForm
        for (var i = 0; i < gpcForm.length; i++) {

            if (desiredGPCs.indexOf(gpcForm[i]) > -1)
                returnVal += '<span class="' + cssDesiredGrapheme + '" data-segment="grapheme">' + gpcForm[i] + '</span>';
            else
                returnVal += gpcForm[i];
        }

        return returnVal;

    }

    /**
     * The formatButton is a div at the end of the editable text that needs to be ignored as we scan and markup the text box.
     * It should be restored witha a call to restoreFormatButton();
     **/

    var stashedFormatButton;

    function stashNonTextUIElementsInEditBox(element) {
        stashedFormatButton = $(element).find('#formatButton');
        if (stashedFormatButton) {
            stashedFormatButton.remove();
        }
    };
    /**
     * The formatButton is a div at the end of the editable text that needs to be ignored as we scan and markup the text box.
     * Calls to this should be preceded by a call to stashFormatButton();
     **/
    function restoreNonTextUIElementsInEditBox(element) {
        if (stashedFormatButton) {
            $(element).append(stashedFormatButton);
            stashedFormatButton = null;
        }
    };

}(jQuery));
