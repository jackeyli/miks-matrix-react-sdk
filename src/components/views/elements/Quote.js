/*
Copyright 2017 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import React from 'react';
import sdk from '../../../index';
import {_t} from '../../../languageHandler';
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';
import {MatrixEvent} from 'matrix-js-sdk';

// For URLs of matrix.to links in the timeline which have been reformatted by
// HttpUtils transformTags to relative links. This excludes event URLs (with `[^\/]*`)
const REGEX_LOCAL_MATRIXTO = /^#\/room\/(([\#\!])[^\/]*)\/(\$[^\/]*)$/;

const MILLIS_IN_DAY = 86400000;
function wantsDateSeparator(parentEvent, event) {
    const parentEventDate = parentEvent.getDate();
    const eventDate = event.getDate();
    if (!eventDate || !parentEventDate) {
        return false;
    }
    // Return early for events that are > 24h apart
    if (Math.abs(parentEvent.getTs() - eventDate.getTime()) > MILLIS_IN_DAY) {
        return true;
    }

    // Compare weekdays
    return parentEventDate.getDay() !== eventDate.getDay();
}

export default class Quote extends React.Component {
    static isMessageUrl(url) {
        return !!REGEX_LOCAL_MATRIXTO.exec(url);
    }

    static childContextTypes = {
        matrixClient: PropTypes.object,
    };

    static propTypes = {
        // The matrix.to url of the event
        url: PropTypes.string,
        // The parent event
        parentEv: PropTypes.instanceOf(MatrixEvent),
    };

    constructor(props, context) {
        super(props, context);

        this.state = {
            // The event related to this quote
            event: null,
        };
    }

    getChildContext() {
        return {
            matrixClient: MatrixClientPeg.get(),
        };
    }

    componentWillReceiveProps(nextProps) {
        let roomId;
        let prefix;
        let eventId;

        if (nextProps.url) {
            // Default to the empty array if no match for simplicity
            // resource and prefix will be undefined instead of throwing
            const matrixToMatch = REGEX_LOCAL_MATRIXTO.exec(nextProps.url) || [];

            roomId = matrixToMatch[1]; // The room ID
            prefix = matrixToMatch[2]; // The first character of prefix
            eventId = matrixToMatch[3]; // The event ID
        }

        const room = prefix === '#' ?
            MatrixClientPeg.get().getRooms().find((r) => {
                return r.getAliases().includes(roomId);
            }) : MatrixClientPeg.get().getRoom(roomId);

        // Only try and load the event if we know about the room
        // otherwise we just leave a `Quote` anchor which can be used to navigate/join the room manually.
        if (room) this.getEvent(room, eventId);
    }

    componentWillMount() {
        this.componentWillReceiveProps(this.props);
    }

    async getEvent(room, eventId) {
        let event = room.findEventById(eventId);
        if (event) {
            this.setState({room, event});
            return;
        }

        await MatrixClientPeg.get().getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
        event = room.findEventById(eventId);
        this.setState({room, event});
    }

    render() {
        const ev = this.state.event;
        if (ev) {
            const EventTile = sdk.getComponent('views.rooms.EventTile');
            let dateSep = null;
            if (wantsDateSeparator(this.props.parentEv, this.state.event)) {
                const DateSeparator = sdk.getComponent('messages.DateSeparator');
                dateSep = <a href={this.props.url}><DateSeparator ts={this.state.event.getDate()} /></a>;
            }

            return <blockquote className="mx_Quote">
                { dateSep }
                <EventTile mxEvent={ev} tileShape="quote" />
            </blockquote>;
        }

        // Deliberately render nothing if the URL isn't recognised
        return <div>
            <a href={this.props.url}>{ _t('Quote') }</a>
            <br />
        </div>;
    }
}
