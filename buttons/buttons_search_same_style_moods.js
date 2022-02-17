﻿'use strict';
//17/02/22

/* 
	Search n tracks (randomly) on library matching at least 2 styles and 6 moods from the current selected track.
	You can configure the number of tracks at properties panel. Also forced query to prefilter tracks.
 */

include('..\\helpers\\buttons_xxx.js');
include('..\\main\\search_same_style_moods.js');
include('..\\helpers\\helpers_xxx_properties.js');
var prefix = 'ss_';
 
try {window.DefinePanel('Search Similar Button', {author:'xxx'});} catch (e) {console.log('Same Styles/Moods Button loaded.');} //May be loaded along other buttons
prefix = getUniquePrefix(prefix, '_'); // Puts new ID before '_'

var newButtonsProperties = { //You can simply add new properties here
	playlistLength: ['Max Playlist Mix length', 50],
	forcedQuery: ['Forced query to filter database (added to any other internal query)', 
				'NOT (%rating% EQUAL 2 OR %rating% EQUAL 1) AND NOT (STYLE IS Live AND NOT STYLE IS Hi-Fi) AND %channels% LESS 3 AND NOT COMMENT HAS Quad'
				],
};
newButtonsProperties['playlistLength'].push({greater: 0, func: isInt}, newButtonsProperties['playlistLength'][1]);
newButtonsProperties['forcedQuery'].push({func: (query) => {return checkQuery(query, true);}}, newButtonsProperties['forcedQuery'][1]);

setProperties(newButtonsProperties, prefix); //This sets all the panel properties at once
buttonsBar.list.push(getPropertiesPairs(newButtonsProperties, prefix));

addButton({
	SearchSimilar: new themedButton({x: 0, y: 0, w: 133, h: 22}, 'Same Styles/Moods', function () {
		let t0 = Date.now();
		let t1 = 0;
		let [playlistLength , forcedQuery] = getPropertiesValues(this.buttonsProperties, this.prefix); //This gets all the panel propierties at once
        do_search_same_style_moods(Number(playlistLength), forcedQuery);
		t1 = Date.now();
		console.log('Call to do_search_similar took ' + (t1 - t0) + ' milliseconds.');
	}, null, void(0),'Random playlist matching at least 2 styles and 6 moods of the current selected track', prefix, newButtonsProperties, chars.link),
});