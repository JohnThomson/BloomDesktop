/** @jsx jsx **/
import { jsx, css } from "@emotion/react";

import React = require("react");
import { get } from "../utils/bloomApi";
import { useEffect, useState } from "react";
import { BloomTooltip } from "./BloomToolTip";
import { Link } from "../react_components/link";
import { useSubscribeToWebSocketForObject } from "../utils/WebSocketManager";
import { LocalizedString } from "./l10nComponents";

export const BookOnBlorgBadge: React.FunctionComponent<{
    book: any;
}> = props => {
    const [bookOnBlorgUrl, setBookOnBlorgUrl] = useState("");

    enum BadgeType {
        None,
        Published,
        Draft,
        OutOfCirculation
    }

    const [badge, setBadge] = useState<BadgeType>(BadgeType.None);

    const updateBadge = () => {
        get(
            `collections/getBookOnBloomBadgeInfo?book-id=${props.book.id}`,
            result => {
                if (result.data.bookUrl) {
                    setBookOnBlorgUrl(result.data.bookUrl);

                    if (result.data.inCirculation === false) {
                        // if inCirculation is null, book is in circulation
                        setBadge(BadgeType.OutOfCirculation);
                    } else if (result.data.draft) {
                        setBadge(BadgeType.Draft);
                    } else {
                        setBadge(BadgeType.Published);
                    }
                } else {
                    setBadge(BadgeType.None);
                }
            }
        );
    };

    useSubscribeToWebSocketForObject<{ bookId: string; url: string }>(
        "libraryPublish",
        "uploadSuccessful",
        results => {
            if (results.bookId === props.book.id) {
                updateBadge();
            }
        }
    );

    useEffect(() => {
        updateBadge();
    }, []);

    return (
        <div
            css={css`
                position: absolute;
                bottom: -15px;
                right: -3px;
            `}
        >
            <React.Fragment>
                {badge !== BadgeType.None && (
                    <BloomTooltip
                        placement={"right"}
                        enableClickInTooltip={true}
                        tip={
                            <div>
                                <span
                                    css={css`
                                        font-variant: all-small-caps;
                                        display: block;
                                        text-align: center;
                                        line-height: 1.5;
                                    `}
                                >
                                    {badge === BadgeType.Published ? (
                                        <LocalizedString l10nKey="CollectionTab.OnBlorgBadge.Published">
                                            Published
                                        </LocalizedString>
                                    ) : badge === BadgeType.Draft ? (
                                        <LocalizedString l10nKey="CollectionTab.OnBlorgBadge.MarkedAsDraft">
                                            Marked As Draft
                                        </LocalizedString>
                                    ) : (
                                        <LocalizedString l10nKey="CollectionTab.OnBlorgBadge.Problem">
                                            Problem
                                        </LocalizedString>
                                    )}
                                </span>
                                <Link
                                    l10nKey="CollectionTab.OnBlorgBadge.ViewOnBlorg"
                                    href={bookOnBlorgUrl}
                                    css={css`
                                        text-decoration: underline;
                                    `}
                                >
                                    View on BloomLibrary.org
                                </Link>
                            </div>
                        }
                    >
                        <img
                            title="" // overwrite ancestor's title so we don't get two tooltips
                            src={
                                badge === BadgeType.Published
                                    ? "/bloom/images/on-blorg-badges/on-blorg-badge.svg"
                                    : badge === BadgeType.Draft
                                    ? "/bloom/images/on-blorg-badges/on-blorg-draft.svg"
                                    : "/bloom/images/on-blorg-badges/on-blorg-problem.svg"
                            }
                        />
                    </BloomTooltip>
                )}
            </React.Fragment>
        </div>
    );
};
