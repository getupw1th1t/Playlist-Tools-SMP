﻿'use strict';
//15/02/22

/* 
	Playlist Tools Menu
	-------------------
	Merges different playlist tools in one menu, called when pressing the button.
	If any script or plugin is missing, then the menu gets created without those entries.
	So the menu is created dynamically according to the foobar user's config.

	NOTE: 'on_mouse_lbtn_up(x, y)' is simply replaced with a button to call the menu.
 */

try {include('..\\helpers\\buttons_xxx.js');} catch (e) {include('helpers\\buttons_xxx.js');}
try { //May be loaded along other buttons
	window.DefinePanel('Playlist Tools: Button', {author:'XXX', version: '3.0.0', features: {drag_n_drop: false}});
	var g_font = _gdiFont('Segoe UI', 12);
	var buttonCoordinates = {x: 0, y: 0, w: 98, h: 22};
} catch (e) {
	buttonCoordinates = {x: 0, y: 0, w: buttonsBar.config.buttonOrientation === 'x' ? 98 : buttonCoordinates.w , h: buttonsBar.config.buttonOrientation === 'y' ? 22 : buttonCoordinates.h}; // Reset 
	console.log('Playlist Tools Menu Button loaded.');
}

{
	const dependencies = [
		'helpers\\helpers_xxx_properties.js',
		'helpers\\helpers_xxx_clipboard.js',
		'main\\playlist_tools_menu.js'];
	let bIncludeRel = true;
	try {include('..\\helpers\\helpers_xxx_dummy.js');} catch(e) {bIncludeRel = false;}
	if (bIncludeRel) {dependencies.forEach((file) => {include('..\\' + file);});}
	else {dependencies.forEach((file) => {include(file);});}
}

var prefix = menu_prefix;
prefix = getUniquePrefix(prefix, ''); // Puts new ID before '_'
menu_prefix = prefix; // update var for internal use of playlist_tools_menu

var newButtonsProperties = {
	...menu_properties,
};

setProperties(newButtonsProperties, prefix, 0); // This sets all the panel properties at once
{
	const properties = getPropertiesPairs(newButtonsProperties, prefix, 0);
	updateMenuProperties(properties); // Update manually the default args
	buttonsBar.list.push({...properties, ...getPropertiesPairs(menu_panelProperties, menu_prefix_panel, 0)});
	// Update cache with user set tags
	doOnce('Update SBD cache', debounce(updateCache, 3000))({properties});
}

addButton({
	menuButton: new themedButton(buttonCoordinates, 'Playlist Tools', function (mask) {
		if (mask === MK_SHIFT) { // Enable/disable menus
			menuAlt.btn_up(this.currX, this.currY + this.currH);
		} else if (mask === MK_CONTROL) { // Simulate menus to get names
			menu.btn_up(this.currX, this.currY + this.currH, void(0), void(0), false, _setClipboardData);
		} else { // Standard use
			menu.btn_up(this.currX, this.currY + this.currH);
		}
		keyCallbackDate = Date.now(); // Update key checking
	}, null, g_font, menuTooltip, null, null, chars.wrench),
});