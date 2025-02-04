﻿'use strict';
//17/02/22

/*
	This is an example of how merging buttons works. Just include them...
	
	-	Note every button file has a line that adds the buttons from the file to the glonal list, so it always merges the new buttons with the previous ones.
			buttons = {...buttons, ...newButtons};
		
	-	First included will be first (left or top), last ones will be last (right or bottom).
		
	-	You can add copies of the same button just by including them multiple times. As is, without touching anything on the button files.
		All IDs and property names are automatically changed accordingly (with a count). That means, copies of buttons will be differents instances of
		the same button for all purposes (with their own properties).
		
	-	You can change orientation for all buttons just by changing 'x' to 'y'. Width (w) and height (h) can also be set.
		
	-	You can change size for specific buttons too but beware: if changing width on 'y' orientation, then you should just change the global width.
		Otherwise, you will have some buttons with the default width and others will be wider... and that looks really weird on vertical orientation.
		Same applies to height for horizontal orientation, better to apply the same height to all buttons, not specific ones, for 'x' orientation.
		
	-	Instead of adding buttons at the end with include functions, you can add your own paths to the array. If some file doesn't exist, then it just gets
		skipped, instead of throwing and error! This is better than try/catch, since it doesn't omit coding errors while including them...
*/

var bLoadTags = true; // Note this must be added before loading helpers! See buttons_search_same_by.js and search_same_by.js
include('..\\..\\helpers\\buttons_xxx.js');
include('..\\..\\helpers\\helpers_xxx.js');
include('..\\..\\helpers\\helpers_xxx_foobar.js');
include('..\\..\\helpers\\helpers_xxx_UI.js');
include('..\\..\\helpers\\buttons_merged_menu.js');

try {window.DefinePanel('Merged Buttons bar', {author:'xxx'});} catch (e) {console.log('Merged Buttons loaded.');} //May be loaded along other buttons

// Global toolbar color
buttonsBar.config.bToolbar = true; // Change this on buttons bars files to set the background color
buttonsBar.config.toolbarColor = RGB(211,218,237);

{	// Buttons
	let buttonsPath = [	 // Add here your buttons path
						folders.xxx + 'buttons\\buttons_search_same_style.js',
						folders.xxx + 'buttons\\buttons_search_same_style_moods.js',
						folders.xxx + 'buttons\\buttons_search_same_by.js',
						folders.xxx + 'buttons\\buttons_search_top_tracks.js',
						folders.xxx + 'buttons\\buttons_playlist_remove_duplicates.js',
						folders.xxx + 'buttons\\buttons_search_bydistance.js',
						folders.xxx + 'buttons\\buttons_tags_automation.js',
						folders.xxx + 'buttons\\buttons_playlist_tools.js',
						];
	
	for (let i = 0; i < buttonsPath.length; i++) {
		if (_isFile(buttonsPath[i])) {
			include(buttonsPath[i], {always_evaluate: true});
		} else {
			console.log(buttonsPath[i] +' not loaded');
		}
	}
	
	/* 	
		OR just add them manually:
		include(folders.xxx + 'buttons\\buttons_search_same_style.js', {always_evaluate: true});
		...
	*/
}
