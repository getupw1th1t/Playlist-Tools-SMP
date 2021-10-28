'use strict';
//28/10/21

/*	
	Scatter by tags
	-----------------------------------
	Reorders selection to avoid consecutive tracks with the same 'tagValue' on tags ('tagName').
	Can be used to scatter instrumental tracks, an specific genre, etc.
	Output is sent to active playlist or as a handle list by setting 'bSendToActivePls'.
*/ 

// For an specific value (tagValue) for a given tag (tagName)
function do_scatter_by_tags({
							tagName = 'genre,style',
							tagValue = 'Instrumental',
							selItems = plman.GetPlaylistSelectedItems(plman.ActivePlaylist),
							bSendToActivePls = true,
							} = {}) {
	// Safety checks
	if (!tagName.length) {return;}
	if (!tagValue.length) {return;}
	if (!selItems || selItems.Count <= 2) {return;}
	// Convert input
	const totalTracks = selItems.Count;
	tagName = tagName.split(',');
	tagValue = tagValue.toLowerCase().split(',');
	const tagValueSet = new Set(tagValue);
	let selItemsArray = selItems.Clone().Convert();
	// Get tag values and find tag value
	const tagValues = getTagsValuesV3(selItems, tagName, true);
	let newOrder = [];
	for (let i = 0; i < totalTracks; i++) {
		const tagValue_i = tagValues[i].filter(Boolean).map((item) => {return item.toLowerCase();});
		const tagSet_i = new Set(tagValue_i);
		if (tagSet_i.intersectionSize(tagValueSet)) { // Any match, then add to reorder list
			newOrder.push(i);
		}
	}
	// Reorder
	const toMoveTracks = newOrder.length;
	const scatterInterval = toMoveTracks ? Math.round(totalTracks / toMoveTracks) : 0;
	if (scatterInterval >= 2) { // Lower value means we can not uniformly scatter instrumental tracks, better left it 'as is'
		let removed = [];
		[...newOrder].reverse().forEach((index) => {
			removed.push(...selItemsArray.splice(index, 1));
		});
		removed.reverse();
		removed.forEach((handle, index) => {
			const i_scatterInterval = index * scatterInterval;
			let j = Math.floor(Math.random() * (scatterInterval - 1)) + i_scatterInterval;
			if (j === 0 && scatterInterval > 2) {j = 1;} // Don't put first track as instrumental if possible
			selItemsArray.splice(j, 0, handle); // (at, 0, item)
		});
	} else {return selItems;}
	// And output
	selItemsArray = new FbMetadbHandleList(selItemsArray);
	if (bSendToActivePls) {
		// 'Hack' Inserts on focus (may be at any place of selection), but then removes the original selection, 
		// so inserted tracks get sent to the right position. Only works for contiguous selections!
		plman.UndoBackup(plman.ActivePlaylist);
		plman.InsertPlaylistItems(plman.ActivePlaylist, plman.GetPlaylistFocusItemIndex(plman.ActivePlaylist), selItemsArray);
		plman.RemovePlaylistSelection(plman.ActivePlaylist); 
		console.log('Selection scattered by tag(s) \'' + tagValue.join(',') + '\' (' + tagName.join(', ') + ') on playlist: ' + plman.GetPlaylistName(plman.ActivePlaylist));
	}
	return selItemsArray;
}

// Does the same but for any value for a given tag
function do_intercalate_by_tags({
							tagName = 'artist',
							selItems = plman.GetPlaylistSelectedItems(plman.ActivePlaylist),
							bSendToActivePls = true,
							} = {}) {
	// Safety checks
	if (!tagName.length) {return;}
	if (!selItems || selItems.Count <= 2) {return;}
	// Convert input
	const totalTracks = selItems.Count;
	tagName = tagName.split(',');
	let selItemsArray = selItems.Convert();
	let selItemsArrayOut = [];
	// Get tag values and find tag value
	const tagValues = getTagsValuesV3(selItems, tagName, true).map((item) => {return item.filter(Boolean).sort().map((item) => {return item.toLowerCase();}).join(',');});
	// Split elements by equal value, by reverse order
	let valMap = new ReverseIterableMap();
	for (let i = totalTracks - 1; i >= 0; i--) {
		const val = tagValues[i];
		if (valMap.has(val)) {
			const newVal = valMap.get(val);
			newVal.push(i);
			valMap.set(val, newVal);
		} else {
			valMap.set(val, [i]);
		}
	}
	// Intercalate them by reverse order again
	while (valMap.size) {
		let toDelete = [];
		valMap.forEachReverse((value, key) => {
			selItemsArrayOut.push(selItemsArray[value.pop()]);
			if (!value.length) {toDelete.push(key);}
		});
		toDelete.forEach((key) => {valMap.delete(key);});
	}
	// And output
	selItemsArray = new FbMetadbHandleList(selItemsArrayOut);
	if (bSendToActivePls) {
		// 'Hack' Inserts on focus (may be at any place of selection), but then removes the original selection, 
		// so inserted tracks get sent to the right position. Only works for contiguous selections!
		plman.UndoBackup(plman.ActivePlaylist);
		plman.InsertPlaylistItems(plman.ActivePlaylist, plman.GetPlaylistFocusItemIndex(plman.ActivePlaylist), selItemsArray);
		plman.RemovePlaylistSelection(plman.ActivePlaylist); 
		console.log('Selection scattered by tag(s) \'' + tagName.join(',') + '\' on playlist: ' + plman.GetPlaylistName(plman.ActivePlaylist));
	}
	return selItemsArray;
}