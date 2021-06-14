'use strict';

include(fb.ProfilePath + 'scripts\\SMP\\xxx-scripts\\helpers\\helpers_xxx.js');
include(fb.ProfilePath + 'scripts\\SMP\\xxx-scripts\\helpers\\helpers_xxx_playlists.js');
include(fb.ProfilePath + 'scripts\\SMP\\xxx-scripts\\helpers\\menu_xxx.js');

const plsHistory = [];
const plsHistoryMax = 11; // -1 for the head (active playlist)

// Utilities
function goPrevPls() {
	const prevPls = getPrevPls();
	if (prevPls !== -1 && prevPls!== plman.ActivePlaylist) {plman.ActivePlaylist = prevPls;}
	return prevPls;
}

function getPrevPls() {
	const idx = plsHistory.length >= 2 ? getPlaylistIndexArray(plsHistory[1].name) : -1;
	const len = idx.length;
	let prevPls = -1;
	if (idx !== -1 && len) {
		if (len === 1 && idx[0] !== -1) {
			prevPls = idx[0];
		} else if (idx.indexOf(plsHistory[1].idx) !== -1) {
			prevPls = plsHistory[1].idx;
		}
	}
	return prevPls;
}

function getPrevPlsName() {
	const prevPls = getPrevPls();
	return prevPls !== -1 ? plman.GetPlaylistName(prevPls) : '-None-'
}

// Menus

function createHistoryMenu() {
	const menu = new _menu(); // To avoid collisions with other buttons and check menu
	menu.newEntry({entryText: 'Switch to previous playlists:', func: null, flags: MF_GRAYED});
	menu.newEntry({entryText: 'sep'});
	menu.newEntry({entryText: 'Previous playlist', func: goPrevPls, flags: () => {return (plsHistory.length >= 2 ? MF_STRING : MF_GRAYED);}});
	menu.newCondEntry({entryText: 'Playlist History... (cond)', condFunc: () => {
		const [, ...list] = plsHistory;
		menu.newEntry({entryText: 'sep'});
		if (!list.length) {menu.newEntry({entryText: '-None-', func: null, flags: MF_GRAYED});}
		list.forEach( (pls, idx) => {
			menu.newEntry({entryText: pls.name, func: () => {
				const idx = getPlaylistIndexArray(pls.name);
				if (idx.length) {
					if (idx.length === 1 && idx[0] !== -1) {
						plman.ActivePlaylist = idx[0];
					} else if (idx.indexOf(pls.idx) !== -1) {
						plman.ActivePlaylist = pls.idx;
					}
				}
			}});
		});
	}, flags: () => {return (plsHistory.length >= 2 ? MF_STRING : MF_GRAYED);}});
	return menu;
}

// Callbacks

function on_playlist_switch() {
	if (plsHistory.length) {
		if (plsHistory.length >= plsHistoryMax) {plsHistory.pop();}
		plsHistory.unshift({name: plman.GetPlaylistName(plman.ActivePlaylist), idx: plman.ActivePlaylist});
	} else {initplsHistory()};
}

function on_playlists_changed() {
	if (plsHistory.length) {
		// Track idx change for playlist already added (when reordering for ex.)
		plsHistory.forEach( (pls) => {
			const idx = getPlaylistIndexArray(pls.name); // Only non duplicated playlists can be tracked
			if (idx.length === 1 && idx[0] !== pls.idx) {pls.idx = idx[0];}
		});
		// Add new playlist if needed
		if (plman.ActivePlaylist !== plsHistory[0].idx) {
			if (plsHistory.length >= plsHistoryMax) {plsHistory.pop();}
			plsHistory.unshift({name: plman.GetPlaylistName(plman.ActivePlaylist), idx: plman.ActivePlaylist});
		}
	} else {initplsHistory()};
}

function on_selection_changed() {
 if (!plsHistory.length) {initplsHistory()}
}

const initplsHistory = delayFn(() => {plsHistory.push({name: plman.GetPlaylistName(plman.ActivePlaylist), idx: plman.ActivePlaylist});}, 300);