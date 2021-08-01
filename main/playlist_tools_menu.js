'use strict';

/* 
	Playlist Tools Menu 03/05/21
	-----------------------------------
	Merges different playlist tools in one menu, called when pressing the button.
	If any script or plugin is missing, then the menu gets created without those entries.
	So the menu is created dynamically according to the foobar user's config.
		
	NOTE: menus are enclosed within {} scopes, so they can be easily rearranged, added or removed
	without affecting the other menus. Only exception to this rule are the menus named 'specialMenu'
	and 'configMenu', sub-menu collecting different entries from multiple scripts; They can be moved the 
	same than the others but obviously removing other menus/scripts affect these ones too.
	
	NOTE2: menuTooltip() can be called when used along buttons or integrated with other scripts to
	show info related to the track. To initiate the menu, call 'menu.btn_up(x, y)'. For ex:
	
	function on_mouse_lbtn_up(x, y) {
		let sel = fb.GetFocusItem();
		if (!sel) {
			return;
		}
		menu.btn_up(x, y)
	}
	*/

include('..\\helpers\\helpers_xxx.js');
include('..\\helpers\\helpers_xxx_prototypes.js');
include('..\\helpers\\helpers_xxx_properties.js');
include('..\\helpers\\helpers_xxx_tags.js');
include('..\\helpers\\helpers_xxx_UI.js');
include('..\\helpers\\menu_xxx.js');

if (!_isFolder(folders.data)) {_createFolder(folders.data);}

// Properties
const bNotProperties = true; // Don't load other properties
var menu_prefix = 'plto'; // Update this variable when loading it along a button
const menu_prefix_panel = menu_prefix;
var menu_properties = { // Properties are set at the end of the script, or must be set along the button. Menus may add new properties here
	playlistLength:				['Global Playlist length', 50],
	forcedQuery:				['Global forced query', 'NOT (%rating% EQUAL 2 OR %rating% EQUAL 1) AND NOT (STYLE IS Live AND NOT STYLE IS Hi-Fi) AND %channels% LESS 3 AND NOT COMMENT HAS Quad'],
	forcedQueryMenusEnabled:	['Menus with forced query enabled', '{}'],
	ratingLimits:				['Set ratings extremes (ex. from 1 to 10 -> 1,10)', '1,5'],
	presets:					['Saved presets', '{}'],
	bShortcuts:					['Enable global shortcuts', false],
	bPlaylistNameCommands:		['Enable playlist name commands', false],
	keyTag:						['Key tag remap', 'key'], // It may be overwritten by Search by distance property too, are equivalent!
	styleGenreTag:				['Style/Genre tags for Dyngenre translation', JSON.stringify(['genre', 'style'])]
};
// Global properties set only once per panel even if there are multiple buttons of the same script
const menu_panelProperties = {
	firstPopup:		['Playlist Tools: Fired once', false],
	menusEnabled: 	['List of menus enabled', '{}'],
	bTooltipInfo: 	['Show shortcuts on tooltip', true],
	bProfile: 		['Profiler logging', false],
	playlistPath: 	['Playlist manager tracked folders', '[]'],
	bDebug:			['Enable global debug to console', false]
};

// Checks
menu_properties['playlistLength'].push({greater: 0, func: Number.isSafeInteger}, menu_properties['playlistLength'][1]);
menu_properties['forcedQuery'].push({func: (query) => {return checkQuery(query, true);}}, menu_properties['forcedQuery'][1]);
menu_properties['ratingLimits'].push({func: (str) => {return (isString(str) && str.length === 3 && str.indexOf(',') === 1);}}, menu_properties['ratingLimits'][1]);

/* 
	Load properties and set default global Parameters
*/
const defaultArgs = {
					playlistLength: menu_properties['playlistLength'][1], 
					forcedQuery: menu_properties['forcedQuery'][1], 
					ratingLimits: menu_properties['ratingLimits'][1].split(','),
					bHttpControl: () => {return utils.CheckComponent('foo_httpcontrol') && _isFolder(fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx')},
					httpControlPath: fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\',
					bDebug: menu_panelProperties['bDebug'][1],
					keyTag: menu_properties['keyTag'][1],
					styleGenreTag: JSON.parse(menu_properties['styleGenreTag'][1])
};
var readmes = {'Playlist Tools Menu': folders.xxx + 'helpers\\readme\\playlist_tools_menu.txt'}; // {scriptName: path}
loadProperties();
const bProfile = getPropertiesPairs(typeof buttons === 'undefined' ? menu_properties : menu_panelProperties, menu_prefix, 0)['bProfile'][1];
// Menu
const specialMenu = 'Special Playlists...';
const configMenu = 'Configuration';
const scriptName = 'Playlist Tools Menu';
const menu = new _menu();

// For enable/disable menus
const menusEnabled = JSON.parse(getPropertiesPairs(typeof buttons === 'undefined' ? menu_properties : menu_panelProperties, menu_prefix, 0)['menusEnabled'][1]);
const menuDisabled = [];
var disabledCount = 0;

// ForcedQuery menus
var forcedQueryMenusEnabled = {};

// Presets menus
var presets = {};

// Other funcs by menus to be applied at property load
const deferFunc = [];

// Key shortcuts
// Menu names strip anything after \t
// Adding new entries here automatically adds them to the associated menu
const shortcutsPath = folders.data + 'playlistTools_shortcuts.json';
var shortcuts = {
	'Look here for key codes': 'https://docs.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes',
	'Tip': 'Any menu entry may be added: submenu_name + \\ + entry_name',
	searchSame: {keys: 'Ctrl + Shift + S',	mod: [VK_CONTROL,VK_SHIFT], val: 83, menu: 'Search same by tags...\\By... (pairs of tags)'},
	prevPls: 	{keys: 'Ctrl + R',			mod: [VK_CONTROL], val: 82, menu: 'Playlist History\\Previous playlist'},
	remDupl: 	{keys: 'Ctrl + D',			mod: [VK_CONTROL], val: 68, menu: 'Duplicates and tag filtering\\Remove duplicates by '},
	quFilter:	{keys: 'Ctrl + G',			mod: [VK_CONTROL], val: 71, menu: 'Query filtering\\Filter playlist by Global forced query'},
	harmMix:	{keys: 'Ctrl + H',			mod: [VK_CONTROL], val: 72, menu: 'Harmonic mix\\Harmonic mix from playlist'},
	deadItm:	{keys: 'Ctrl + Shift + R',	mod: [VK_CONTROL,VK_SHIFT], val: 82, menu: 'Playlist Revive\\Find dead items in all playlists'},
	// close:		{keys: 'Esc',				mod: [VK_SHIFT], val: VK_ESCAPE, menu: '', func: () => {fb.Exit()}},
}

// Other script integration
// Callbacks: append to any previously existing callback
function onNotifyData(name, info) { 
	switch (name) {
		case 'Playlist manager: playlistPath': {
			if (info && info.length) {
				const properties =  getPropertiesPairs((typeof buttons === 'undefined' ? menu_properties : menu_panelProperties), menu_prefix_panel, 0);
				const playlistPath = JSON.parse(properties.playlistPath[1]);
				let bDone = false;
				if (isArrayStrings(info)) {
					if (!new Set(playlistPath).isSuperset(new Set(info))) {
						playlistPath.concat([...new Set(info).difference(new Set(playlistPath))])
						bDone = true;
					}
				} else if (isStringWeak(info)) {
					if (playlistPath.indexOf(info) === -1) {
						playlistPath.push(info);
						bDone = true;
					}
				}
				if (bDone) {
					properties.playlistPath[1] = JSON.stringify(playlistPath);
					overwriteProperties(properties); // Updates panel
				}
			}
			break;
		}
	}
}
if (typeof on_notify_data !== 'undefined') {
	const oldFunc = on_notify_data;
	on_notify_data = function(name, info) {
		oldFunc(name, info);
		onNotifyData(name, info);
	}
} else {var on_notify_data = onNotifyData;}

function onPlaylistsChanged() {
	const properties = getPropertiesPairs(menu_properties, menu_prefix, 0);
	if (properties.bPlaylistNameCommands[1]) {
		const playlistData = {num: plman.PlaylistCount, name: range(0, plman.PlaylistCount - 1, 1).map((idx) => {return plman.GetPlaylistName(idx);})};
		playlistData.name.forEach((name, index) => {
			const lName = name.toLowerCase();
			if (lName.startsWith('pt:')) {
				const command = name.slice(3);
				const lCommand = lName.slice(3);
				switch (lCommand) { // Short aliases
					case 'output' : {
						break; // Do nothing!
					}
					case 'duplicates': { // Meant to be used with current playlist after renaming!
						const sortInputDuplic = properties.hasOwnProperty('sortInputDuplic') ? properties.sortInputDuplic[1].replace(/,/g, ', ') : null;
						if (sortInputDuplic) {
							plman.ActivePlaylist = index;
							menu.btn_up(void(0), void(0), void(0), 'Duplicates and tag filtering\\Remove duplicates by ' + sortInputDuplic);
							plman.RenamePlaylist(plman.ActivePlaylist, 'Output');
						}
						break;
					}
					case 'harmonic': { // Meant to be used with current playlist after renaming!
						menu.btn_up(void(0), void(0), void(0), 'Harmonic mix\\Harmonic mix from playlist');
						plman.RemovePlaylist(index);
						break;
					}
					case 'graph': { // Requires a track on pls
						menu.btn_up(void(0), void(0), void(0), 'Search similar by Graph...\\Similar Genre mix, within a decade');
						plman.RemovePlaylist(index);
						break;
					}
					case 'filter': { // Meant to be used with current playlist after renaming!
						const sortInputFilter = properties.hasOwnProperty('sortInputFilter') ? properties.sortInputFilter[1].replace(/,/g, ', ') : null;
						const nAllowed = properties.hasOwnProperty('nAllowed') ? '(' + properties.nAllowed[1] + ')' : null;
						if (sortInputFilter && nAllowed) {
							plman.ActivePlaylist = index;
							menu.btn_up(void(0), void(0), void(0), ' Duplicates and tag filtering\Filter playlist by ' + sortInputFilter + ' ' + nAllowed);
							plman.RenamePlaylist(plman.ActivePlaylist, 'Output');
						}
						break;
					}
					case 'similar': { // Requires a track on pls
						menu.btn_up(void(0), void(0), void(0), 'Search same by tags...\\By Styles (=2) and Moods (=6)');
						plman.RemovePlaylist(index);
						break;
					}
					default: { // Full menus
						if (command.indexOf('\\') !== -1) {
							plman.RemovePlaylistSwitch(index);
							menu.btn_up(void(0), void(0), void(0), command);
						}
					}
				}
			}
		});
	}
}
if (typeof on_playlists_changed !== 'undefined') {
	const oldFunc = on_playlists_changed;
	on_playlists_changed = function() {
		oldFunc();
		onPlaylistsChanged();
	}
} else {var on_playlists_changed = onPlaylistsChanged;}

function onOutputDeviceChanged() {
	if (typeof exportDevices !== 'undefined') {
		if (defaultArgs.bHttpControl() && !exportDevices(defaultArgs.httpControlPath)) {console.log('Error saving Devices entries for http Control integration.')}
	}
}
if (typeof on_output_device_changed !== 'undefined') {
	const oldFunc = on_output_device_changed;
	on_output_device_changed = function() {
		oldFunc();
		onOutputDeviceChanged();
	}
} else {var on_output_device_changed = onOutputDeviceChanged;}

function onDspPresetChanged() {
	if (typeof exportDSP !== 'undefined') {
		if (defaultArgs.bHttpControl() && !exportDSP(defaultArgs.httpControlPath)) {console.log('Error saving DSP entries for http Control integration.')}
	}
}
if (typeof on_dsp_preset_changed !== 'undefined') {
	const oldFunc = on_dsp_preset_changed;
	on_dsp_preset_changed = function() {
		oldFunc();
		onDspPresetChanged();
	}
} else {var on_dsp_preset_changed = onDspPresetChanged;}


/* 
	Menus
*/
// Top Tracks from year
{
	const scriptPath = folders.xxx + 'main\\top_tracks_from_date.js';
	const scriptPathElse = folders.xxx + 'main\\top_tracks.js';
	if (utils.CheckComponent('foo_enhanced_playcount') && (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e'))) {
		const name = 'Most played Tracks from...';
		if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
			include(scriptPath);
			readmes[name] = folders.xxx + 'helpers\\readme\\top_tracks_from_date.txt';
			const menuName = menu.newMenu(name);
			menu.newEntry({menuName, entryText: 'Based on play counts within a period:', func: null, flags: MF_GRAYED});
			menu.newEntry({menuName, entryText: 'sep'});
			{	// Static menus
				const currentYear = new Date().getFullYear();
				const selYearArr = [currentYear, currentYear - 1, currentYear - 2];
				selYearArr.forEach( (selYear) => {
					let selArgs = {year: selYear};
					menu.newEntry({menuName, entryText: 'Most played from ' + selYear, func: (args = {...defaultArgs, ...selArgs}) => {do_top_tracks_from_date(args);}});
					});
			}
			menu.newEntry({menuName, entryText: 'sep'});
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPathElse) : utils.FileTest(scriptPathElse, 'e')){
				// All years
				include(scriptPathElse);
				menu.newEntry({menuName, entryText: 'Most played (all years)', func: (args = {...defaultArgs}) => {do_top_tracks(args);}});
				menu.newEntry({menuName, entryText: 'sep'});
			}
			{	// Input menu: x year
				menu.newEntry({menuName, entryText: 'From year...', func: () => {
					const selYear = new Date().getFullYear();
					let input;
					try {input = Number(utils.InputBox(window.ID, 'Enter year:', scriptName + ': ' + name, selYear, true));}
					catch (e) {return;}
					if (!Number.isSafeInteger(input)) {return;}
					do_top_tracks_from_date({...defaultArgs,  year: input});
					}});
			}
			{	// Input menu: last x time
				menu.newEntry({menuName, entryText: 'From last...', func: () => {
					let input;
					try {input = utils.InputBox(window.ID, 'Enter a number and time-unit. Can be:\n' + Object.keys(timeKeys).join(', '), scriptName + ': ' + name, '4 WEEKS', true).trim();}
					catch (e) {return;}
					if (!input.length) {return;}
					do_top_tracks_from_date({...defaultArgs,  last: input, bUseLast: true});
					}});
			}
			menu.newEntry({entryText: 'sep'});
		} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
	} else if (utils.CheckComponent('foo_playcount') && (isCompatible('1.4.0') ? utils.IsFile(scriptPathElse) : utils.FileTest(scriptPathElse, 'e'))) { //TODO: Deprecated
		const name = 'Most played Tracks';
		if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
			readmes[name] = folders.xxx + 'helpers\\readme\\top_tracks.txt';
			// All years
			include(scriptPathElse);
			menu.newEntry({entryText: name, func: (args = { ...defaultArgs}) => {do_top_tracks(args);}}); // Skips menu name, added to top
			menu.newEntry({entryText: 'sep'});
		} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1  + disabledCount++});}
	}
}

// Top rated Tracks from year
{
	const scriptPath = folders.xxx + 'main\\top_rated_tracks.js';
	if (utils.CheckComponent('foo_playcount') && (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e'))) {
		const name = 'Top rated Tracks from...';
		if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
			include(scriptPath);
			readmes[name] = folders.xxx + 'helpers\\readme\\top_rated_tracks.txt';
			const menuName = menu.newMenu(name);
			menu.newEntry({menuName, entryText: 'Based on ratings (' + defaultArgs.ratingLimits.join(' to ') + '):', func: null, flags: MF_GRAYED});
			menu.newEntry({menuName, entryText: 'sep'});
			const currentYear = new Date().getFullYear();
			const selYearArr = [ [currentYear], [2000, currentYear], [1990, 2000], [1980, 1990], [1970, 1980], [1960, 1970], [1950, 1940]];
			selYearArr.forEach( (selYear) => {
				let selArgs = { ...defaultArgs};
				let dateQuery = '';
				if (selYear.length === 2) {
					dateQuery = '"$year(%date%)" GREATER ' + selYear[0] + ' AND "$year(%date%)" LESS ' + selYear[1];
				} else {
					dateQuery = '"$year(%date%)" IS ' + selYear;
				}
				selArgs.forcedQuery = selArgs.forcedQuery.length ? '(' + dateQuery + ') AND (' + selArgs.forcedQuery + ')' : dateQuery;
				selArgs.playlistName = 'Top ' + selArgs.playlistLength + ' Rated Tracks ' + selYear.join('-');
				menu.newEntry({menuName, entryText: 'Top rated from ' + selYear.join('-'), func: (args = selArgs) => {do_top_rated_tracks(args);}});
			});
			menu.newEntry({menuName, entryText: 'sep'});
			{	// Input menu
				menu.newEntry({menuName, entryText: 'From year...', func: () => {
					let selYear = new Date().getFullYear();
					try {selYear = utils.InputBox(window.ID, 'Enter year or range of years\n(pair separated by comma)', scriptName + ': ' + name, selYear, true);}
					catch (e) {return;}
					if (!selYear.length) {return;}
					selYear = selYear.split(','); // May be a range or a number
					for (let i = 0; i < selYear.length; i++) {
						selYear[i] = Number(selYear[i]);
						if (!Number.isSafeInteger(selYear[i])) {return;}
					}
					let selArgs = { ...defaultArgs};
					let dateQuery = '';
					if (selYear.length === 2) {
						dateQuery = '"$year(%date%)" GREATER ' + selYear[0] + ' AND "$year(%date%)" LESS ' +  selYear[1];
					} else {
						dateQuery = '"$year(%date%)" IS ' + selYear;
					}
					selArgs.forcedQuery = selArgs.forcedQuery.length ? '(' + dateQuery + ') AND (' + selArgs.forcedQuery + ')' : dateQuery;
					selArgs.playlistName = 'Top ' + selArgs.playlistLength + ' Rated Tracks ' + selYear.join('-');
					do_top_rated_tracks(selArgs);
				}});
			}
			menu.newEntry({entryText: 'sep'});
		} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
	}
}

// Same by...
{
	const scriptPath = folders.xxx + 'main\\search_same_by.js';
	if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
		const name = 'Search same by tags...';
		if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
			include(scriptPath);
			readmes[name] = folders.xxx + 'helpers\\readme\\search_same_by.txt';
			forcedQueryMenusEnabled[name] = true;
			const menuName = menu.newMenu(name);
			{	// Dynamic menu
				let sameByQueries = [
					{args: {sameBy: {mood: 6}}}, {args: {sameBy: {genre: 2}}}, {args: {sameBy: {style: 2}}},
					{args: {sameBy: {composer: 2}}}, {args: {sameBy: {key: 1}}},
					{name: 'sep'},
					{args: {sameBy: {style: 2, mood: 6}}}, {args: {sameBy: {style: 2, date: 10}}},
				];
				let selArg = {...sameByQueries[0]};
				const sameByQueriesDefaults = [...sameByQueries];
				// Create new properties with previous args
				menu_properties['sameByQueries'] = [name + ' queries', JSON.stringify(sameByQueries)];
				menu_properties['sameByCustomArg'] = [name + ' Dynamic menu custom args', convertObjectToString(selArg.args.sameBy)];
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				// Menus
				menu.newEntry({menuName, entryText: 'Based on Queries matching minimum (X) tags:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName, entryText: 'sep'});
				menu.newCondEntry({entryText: 'Search same by tags... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					// Entry list
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					sameByQueries = JSON.parse(args.properties['sameByQueries'][1]);
					sameByQueries.forEach( (queryObj) => {
						// Add separators
						if (queryObj.hasOwnProperty('name') && queryObj.name === 'sep') {
							let entryMenuName = queryObj.hasOwnProperty('menu') ? queryObj.menu : menuName;
							menu.newEntry({menuName: entryMenuName, entryText: 'sep'});
						} else { 
							// Create names for all entries
							let queryName = '';
							if (!queryObj.hasOwnProperty('name') || !queryObj.name.length) {
								Object.keys(queryObj.args.sameBy).forEach((key, index, array) => {
									queryName += (!queryName.length ? '' : index !== array.length - 1 ? ', ' : ' and ');
									queryName += capitalize(key) + (queryObj.args.sameBy[key] > 1 ? 's' : '') + ' (=' + queryObj.args.sameBy[key] + ')';
									});
							} else {queryName = queryObj.name;}
							queryName = queryName.length > 40 ? queryName.substring(0,40) + ' ...' : queryName;
							queryObj.name = queryName;
							// Entries
							const sameByArgs = {...queryObj.args, playlistLength: args.playlistLength, forcedQuery: args.forcedQuery};
							if (!forcedQueryMenusEnabled[name]) {sameByArgs.forcedQuery = '';}
							menu.newEntry({menuName, entryText: 'By ' + queryName, func: () => {do_search_same_by(sameByArgs);}, flags: focusFlags});
						}
					});
					menu.newEntry({menuName, entryText: 'sep'});
					{ // Static menu: user configurable
						menu.newEntry({menuName, entryText: 'By... (pairs of tags)', func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg.args}) => {
							// On first execution, must update from property
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.sameBy = selArg.args.sameBy = convertStringToObject(args.properties['sameByCustomArg'][1], 'number', ',');
							// Input
							let input;
							try {input = utils.InputBox(window.ID, 'Enter pairs of \'tag, number of matches\', separated by comma.\n', scriptName + ': ' + name, convertObjectToString(args.sameBy, ','), true);}
							catch (e) {return;}
							if (!input.length) {return;}
							// For internal use original object
							selArg.args.sameBy = convertStringToObject(input, 'number', ',');
							args.properties['sameByCustomArg'][1] = convertObjectToString(selArg.args.sameBy); // And update property with new value
							overwriteProperties(args.properties); // Updates panel
							const sameByArgs = {...selArg.args, playlistLength: args.playlistLength, forcedQuery: args.forcedQuery};
							if (!forcedQueryMenusEnabled[name]) {sameByArgs.forcedQuery = '';}
							do_search_same_by(sameByArgs);
						}, flags: focusFlags});
						// Menu to configure property
						menu.newEntry({menuName, entryText: 'sep'});
					}
					{	// Add / Remove
						menu.newEntry({menuName, entryText: 'Add new entry to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg.args}) => {
							// Input all variables
							let input;
							let entryName = '';
							try {entryName = utils.InputBox(window.ID, 'Enter name for menu entry\nWrite \'sep\' to add a line.', scriptName + ': ' + name, '', true);}
							catch (e) {return;}
							if (entryName === 'sep') {input = {name: entryName};} // Add separator
							else { // or new entry
								try {input = utils.InputBox(window.ID, 'Enter pairs of \'tag, number of matches\', separated by comma.\n', scriptName + ': ' + name, convertObjectToString(args.sameBy, ','), true);}
								catch (e) {return;}
								if (!input.length) {return;}
								if (input.indexOf(',') === -1) {return;}
								if (input.indexOf(';') !== -1) {return;}
								let logic = 'AND';
								try {logic = utils.InputBox(window.ID, 'Enter logical operator to combine queries for each different tag.\n', scriptName + ': ' + name, logic, true);}
								catch (e) {return;}
								if (!logic.length) {return;}
								let remap;
								try {remap = utils.InputBox(window.ID, 'Remap tags to apply the same query to both.\nEnter \'mainTagA,toTag,...;mainTagB,...\'\nSeparated by \',\' and \';\'.\n', scriptName + ': ' + name, '', true);}
								catch (e) {return;}
								let bOnlyRemap = false;
								if (remap.length) {
									const answer = WshShell.Popup('Instead of applying the same query remapped tags, the original tag may be remapped to the desired track. Forcing that Tag B should match TagA.\nFor example: Finds tracks where involved people matches artist from selection', 0, scriptName + ': ' + name, popup.question + popup.yes_no);
									if (answer === popup.yes) {bOnlyRemap = true;}
								}
								input = {name: entryName, args: {sameBy: convertStringToObject(input, 'number', ','), logic, remapTags: remap.length ? convertStringToObject(remap, 'string', ',', ';') : {}, bOnlyRemap}};
								// Final check
								const sel = fb.GetFocusItem();
								if (sel) {
									const selInfo = sel.GetFileInfo();
									if (!Object.keys(input.args.sameBy).every((key) => {return selInfo.MetaFind(key) === -1})) {
										try {if (!do_search_same_by({...input.args, bSendToPls: false})) {throw 'error';}}
										catch (e) {fb.ShowPopupMessage('Arguments not valid, check them and try again:\n' + JSON.stringify(input), scriptName);return;}
									}
								}
							}
							// Add entry
							sameByQueries.push(input);
							// Save as property
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.properties['sameByQueries'][1] = JSON.stringify(sameByQueries); // And update property with new value
							// Presets
							if (!presets.hasOwnProperty('sameByQueries')) {presets.sameByQueries = [];}
							presets.sameByQueries.push(input);
							args.properties['presets'][1] = JSON.stringify(presets);
							overwriteProperties(args.properties); // Updates panel
						}});
						{
							const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), menuName);
							sameByQueries.forEach( (queryObj, index) => {
								const entryText = (queryObj.name === 'sep' ? '------(separator)------' : (queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name));
								menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
									sameByQueries.splice(index, 1);
									args.properties['sameByQueries'][1] = JSON.stringify(sameByQueries);
									// Presets
									if (presets.hasOwnProperty('sameByQueries')) {
										presets.sameByQueries.splice(presets.sameByQueries.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(queryObj);}), 1);
										if (!presets.sameByQueries.length) {delete presets.sameByQueries;}
										args.properties['presets'][1] = JSON.stringify(presets);
									}
									overwriteProperties(args.properties); // Updates panel
								}});
							});
							if (!sameByQueries.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
							menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
							menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
								sameByQueries = [...sameByQueriesDefaults];
								args.properties['sameByQueries'][1] = JSON.stringify(sameByQueries);
								// Presets
								if (presets.hasOwnProperty('sameByQueries')) {
									delete presets.sameByQueries;
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
							}});
						}
					}
				}});
			}
			{	// Static menus: Special playlist (at other menu)
				if (!menusEnabled.hasOwnProperty(specialMenu) || menusEnabled[specialMenu] === true) {
					menu.newEntry({menuName: specialMenu, entryText: 'Based on Queries:', func: null, flags: MF_GRAYED}); // Jumps just before special playlists
					const selArgs = [ 
						{title: 'sep', menu: specialMenu},
						{title: 'Same artist(s) or featured artist(s)', menu: specialMenu, args: {sameBy: {artist: 1, involvedpeople: 1}, remapTags: {artist: ['involvedpeople'], involvedpeople: ['artist']}, bOnlyRemap: false, logic: 'OR'}},  // Finds tracks where artist or involved people matches any from selection
						{title: 'Find collaborations along other artists', menu: specialMenu, args: {sameBy: {artist: 1}, remapTags: {artist: ['involvedpeople']}, bOnlyRemap: true, logic: 'OR'}},  // Finds tracks where involved people matches artist from selection (remap)
						{title: 'Music by same composer(s) as artist(s)', menu: specialMenu, args: {sameBy: {composer: 1}, remapTags: {composer: ['involvedpeople', 'artist']}, bOnlyRemap: true, logic: 'OR'}}, // Finds tracks where artist or involvedpeople matches composer from selection (remap)
						{title: 'sep', menu: specialMenu},
					];
					selArgs.forEach( (selArg) => {
						if (selArg.title === 'sep') {
							let entryMenuName = selArg.hasOwnProperty('menu') ? selArg.menu : menuName;
							menu.newEntry({menuName: entryMenuName, entryText: 'sep'});
						} else {
							let entryText = '';
							if (!selArg.hasOwnProperty('title')) {
								Object.keys(selArg.args.sameBy).forEach((key, index, array) => {
									entryText += (!entryText.length ? '' : index !== array.length - 1 ? ', ' : ' and ');
									entryText += capitalize(key) + (selArg.args.sameBy[key] > 1 ? 's' : '') + ' (=' + selArg.args.sameBy[key] + ')';
									});
							} else {entryText = selArg.title;}
							let entryMenuName = selArg.hasOwnProperty('menu') ? selArg.menu : menuName;
							menu.newEntry({menuName: entryMenuName, entryText, func: (args = {...defaultArgs, ...selArg.args}) => {do_search_same_by(args);}, flags: focusFlags});
						}
					});
				} else {menuDisabled.push({menuName: specialMenu, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
				menu.newEntry({entryText: 'sep'});
			}
		}
	}
}

// Standard Queries...
{
	const scriptPath = folders.xxx + 'main\\dynamic_query.js';
	if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
		const name = 'Standard Queries...';
		if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
			include(scriptPath);
			readmes[name] = folders.xxx + 'helpers\\readme\\dynamic_query.txt';
			forcedQueryMenusEnabled[name] = true;
			const menuName = menu.newMenu(name);
			{	// Dynamic menu
				let queryFilter = [
					{name: 'Entire library', query: 'ALL', sort: {tfo: '', direction: -1}},
					{name: 'Entire library (forced query)', query: '', sort: {tfo: '', direction: -1}},
					{name: 'sep'},
					{name: 'Rating 4-5', query: '%rating% EQUAL 5 OR %rating% EQUAL 4', sort: {tfo: '%rating%', direction: 1}},
					{name: 'sep'},
					{name: 'Recently played', query: '%last_played% DURING LAST 1 WEEK', sort: {tfo: '%last_played%', direction: -1}},
					{name: 'Recently added', query: '%added% DURING LAST 1 WEEK', sort: {tfo: '%added%', direction: -1}},
					{name: 'sep'},
					{name: 'Rock tracks', query: 'GENRE IS Rock OR GENRE IS Alt. Rock OR GENRE IS Progressive Rock OR GENRE IS Hard Rock OR GENRE IS Rock & Roll', sort: {tfo: '$rand()', direction: 1}},
					{name: 'Psychedelic tracks', query: 'GENRE IS Psychedelic Rock OR GENRE IS Psychedelic OR STYLE IS Neo-Psychedelia OR STYLE IS Psychedelic Folk', sort: {tfo: '$rand()', direction: 1}},
					{name: 'Folk \\ Country tracks', query: 'GENRE IS Folk OR GENRE IS Folk-Rock OR GENRE IS Country', sort: {tfo: '$rand()', direction: 1}},
					{name: 'Blues tracks', query: 'GENRE IS Blues', sort: {tfo: '$rand()', direction: 1}},
					{name: 'Jazz tracks', query: 'GENRE IS Jazz OR GENRE IS Jazz Vocal', sort: {tfo: '$rand()', direction: 1}},
					{name: 'Soul \\ RnB tracks', query: 'GENRE IS Soul OR STYLE IS R&B', sort: {tfo: '$rand()', direction: 1}},
					{name: 'Hip-Hop tracks', query: 'GENRE IS Hip-Hop', sort: {tfo: '$rand()', direction: 1}}
				];
				let selArg = {name: 'Custom', query: queryFilter[0].query};
				const queryFilterDefaults = [...queryFilter];
				// Create new properties with previous args
				menu_properties['searchQueries'] = [name + ' queries', JSON.stringify(queryFilter)];
				menu_properties['searchCustomArg'] = [name + ' Dynamic menu custom args', JSON.stringify(selArg)];
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				// Menus
				menu.newEntry({menuName, entryText: 'Standard search with queries:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName, entryText: 'sep'});
				menu.newCondEntry({entryText: 'Search library... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					// Entry list
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					queryFilter = JSON.parse(args.properties['searchQueries'][1]);
					queryFilter.forEach( (queryObj) => {
						// Add separators
						if (queryObj.hasOwnProperty('name') && queryObj.name === 'sep') {
							let entryMenuName = queryObj.hasOwnProperty('menu') ? queryObj.menu : menuName;
							menu.newEntry({menuName: entryMenuName, entryText: 'sep'});
						} else { 
							// Create names for all entries
							let queryName = queryObj.name;
							queryName = queryName.length > 40 ? queryName.substring(0,40) + ' ...' : queryName;
							// Entries
							menu.newEntry({menuName, entryText: queryName, func: () => {
								let query = queryObj.query;
								if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) { // With forced query enabled
									if (query.length && query.toUpperCase() !== 'ALL') { // ALL query never uses forced query!
										query = '(' + query + ') AND (' + args.forcedQuery + ')';
									} else if (!query.length) {query =  args.forcedQuery;} // Empty uses forced query or ALL
								} else if (!query.length) {query = 'ALL';} // Otherwise empty is replaced with ALL
								do_dynamic_query({query, sort: queryObj.sort}); 
							}});
						}
					});
					menu.newEntry({menuName, entryText: 'sep'});
					{ // Static menu: user configurable
						menu.newEntry({menuName, entryText: 'By... (query)', func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
							// On first execution, must update from property
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.query = selArg.query = JSON.parse(args.properties['searchCustomArg'][1]).query;
							// Input
							let query;
							try {query = utils.InputBox(window.ID, 'Enter query:', scriptName + ': ' + name, args.query, true);}
							catch (e) {return;}
							// Playlist
							let handleList = do_dynamic_query({query: forcedQueryMenusEnabled[name] && args.forcedQuery.length ? (query.length && query.toUpperCase() !== 'ALL' ? '(' + query + ') AND (' + args.forcedQuery + ')' : query) : (!query.length ? 'ALL' : query)});
							if (!handleList) {fb.ShowPopupMessage('Query failed:\n' + query, scriptName); return;}
							// For internal use original object
							selArg.query = query;
							args.properties['searchCustomArg'][1] = JSON.stringify(selArg); // And update property with new value
							overwriteProperties(args.properties); // Updates panel
						}});
						// Menu to configure property
						menu.newEntry({menuName, entryText: 'sep'});
					}
					{	// Add / Remove
						menu.newEntry({menuName, entryText: 'Add new entry to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
							// Input all variables
							let input;
							let entryName = '';
							try {entryName = utils.InputBox(window.ID, 'Enter name for menu entry\nWrite \'sep\' to add a line.', scriptName, '', true);}
							catch (e) {return;}
							if (!entryName.length) {return;}
							if (entryName === 'sep') {input = {name: entryName};} // Add separator
							else { // or new entry
								let query = '';
								try {query = utils.InputBox(window.ID, 'Enter query:', scriptName + ': ' + name, args.query, true);}
								catch (e) {return;}
								if (!query.length) {return;}
								if (!checkQuery(query, true)) {fb.ShowPopupMessage('query not valid, check it and try again:\n' + query, scriptName);return}
								let tfo = '';
								try {tfo = utils.InputBox(window.ID, 'Enter TF expression for sorting:', scriptName + ': ' + name, '', true);}
								catch (e) {return;}
								let direction = 1;
								try {direction = Number(utils.InputBox(window.ID, 'Direction:\n(-1 or 1)', scriptName + ': ' + name, 1, true));}
								catch (e) {return;}
								if (isNaN(direction)) {return;}
								direction = direction > 0 ? 1 : -1;
								input = {name: entryName, query, sort: {tfo, direction}};
							}
							// Add entry
							queryFilter.push(input);
							// Save as property
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.properties['searchQueries'][1] = JSON.stringify(queryFilter); // And update property with new value
							// Presets
							if (!presets.hasOwnProperty('searchQueries')) {presets.searchQueries = [];}
							presets.searchQueries.push(input);
							args.properties['presets'][1] = JSON.stringify(presets);
							overwriteProperties(args.properties); // Updates panel
						}});
						{
							const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), menuName);
							queryFilter.forEach( (queryObj, index) => {
								const entryText = (queryObj.name === 'sep' ? '------(separator)------' : (queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name));
								menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
									queryFilter.splice(index, 1);
									args.properties['searchQueries'][1] = JSON.stringify(queryFilter);
									// Presets
									if (presets.hasOwnProperty('searchQueries')) {
										presets.searchQueries.splice(presets.searchQueries.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(queryObj);}), 1);
										if (!presets.searchQueries.length) {delete presets.searchQueries;}
										args.properties['presets'][1] = JSON.stringify(presets);
									}
									overwriteProperties(args.properties); // Updates panel
								}});
							});
							if (!queryFilter.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
							menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
							menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
								queryFilter = [...queryFilterDefaults];
								args.properties['searchQueries'][1] = JSON.stringify(queryFilter);
								// Presets
								if (presets.hasOwnProperty('searchQueries')) {
									delete presets.searchQueries;
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
							}});
						}
					}
				}});
			}
		} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
	}
}

// Dynamic queries...
{
	const scriptPath = folders.xxx + 'main\\dynamic_query.js';
	if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
		const name = 'Dynamic Queries...';
		if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
			include(scriptPath);
			readmes[name] = folders.xxx + 'helpers\\readme\\dynamic_query.txt';
			forcedQueryMenusEnabled[name] = false;
			const menuName = menu.newMenu(name);
			{	// Dynamic menu
				let queryFilter = [
					{name: 'Same title (any artist)'	, query: 'TITLE IS #TITLE#'},
					{name: 'Same songs (by artist)'		, query: 'TITLE IS #TITLE# AND ARTIST IS #ARTIST#'},
					{name: 'Duplicates on library'		, query: 'TITLE IS #TITLE# AND ARTIST IS #ARTIST# AND DATE IS #$year(%date%)#'},
					{name: 'Same date (any track)'		, query: 'DATE IS #$year(%date%)#'},
					{name: 'Live versions of same song'	, query: 'TITLE IS #TITLE# AND ARTIST IS #ARTIST# AND (GENRE IS Live OR STYLE IS Live)'},
				];
				const queryFilterDefaults = [...queryFilter];
				let selArg = {query: queryFilter[0].query};
				// Create new properties with previous args
				menu_properties['dynamicQueries'] = [name + ' queries', JSON.stringify(queryFilter)];
				menu_properties['dynamicQueriesCustomArg'] = [name + ' Dynamic menu custom args', selArg.query];
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				// Menus
				menu.newEntry({menuName, entryText: 'Based on queries evaluated with sel:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName, entryText: 'sep'});
				menu.newCondEntry({entryText: 'Dynamic Queries... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					// Entry list
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					queryFilter = JSON.parse(args.properties['dynamicQueries'][1]);
					queryFilter.forEach( (queryObj) => {
						// Add separators
						if (queryObj.hasOwnProperty('name') && queryObj.name === 'sep') {
							let entryMenuName = queryObj.hasOwnProperty('menu') ? queryObj.menu : menuName;
							menu.newEntry({menuName: entryMenuName, entryText: 'sep'});
						} else { 
							// Create names for all entries
							queryObj.name = queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name;
							// Entries
							menu.newEntry({menuName, entryText: queryObj.name, func: () => {
								let query = queryObj.query;
								if (query.indexOf('#') !== -1 && !fb.GetFocusItem(true)) {fb.ShowPopupMessage('Can not evaluate query without a selection:\n' + queryObj.query, scriptName); return;}
								if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) {  // With forced query enabled
									if (query.length && query.toUpperCase() !== 'ALL') { // ALL query never uses forced query!
										query = '(' + query + ') AND (' + args.forcedQuery + ')';
									} else if (!query.length) {query = args.forcedQuery;} // Empty uses forced query or ALL
								} else if (!query.length) {query = 'ALL';} // Otherwise empty is replaced with ALL
								do_dynamic_query({query, sort: queryObj.sort});
							}, flags: focusFlags});
						}
					});
					menu.newEntry({menuName, entryText: 'sep'});
					{ // Static menu: user configurable
						menu.newEntry({menuName, entryText: 'By... (query)', func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
							// On first execution, must update from property
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.query = selArg.query = args.properties['dynamicQueriesCustomArg'][1];
							// Input
							let query = '';
							try {query = utils.InputBox(window.ID, 'Enter query:\nAlso allowed dynamic variables, like #ARTIST#, which will be replaced with focused item\'s value.', scriptName + ': ' + name, args.query, true);}
							catch (e) {return;}
							if (query.indexOf('#') !== -1 && !fb.GetFocusItem(true)) {fb.ShowPopupMessage('Can not evaluate query without a selection:\n' + query, scriptName); return;}
							// Playlist
							let handleList = do_dynamic_query({query: forcedQueryMenusEnabled[name] && args.forcedQuery.length ? (query.length && query.toUpperCase() !== 'ALL' ? '(' + query + ') AND (' + args.forcedQuery + ')' : query) : (!query.length ? 'ALL' : query)});
							if (!handleList) {fb.ShowPopupMessage('Query failed:\n' + query, scriptName); return;}
							// For internal use original object
							selArg.query = query; 
							args.properties['dynamicQueriesCustomArg'][1] = query; // And update property with new value
							overwriteProperties(args.properties); // Updates panel
						}, flags: focusFlags});
						// Menu to configure property
						menu.newEntry({menuName, entryText: 'sep'});
					}
					{	// Add / Remove
						menu.newEntry({menuName, entryText: 'Add new entry to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							// Input all variables
							let input;
							let entryName = '';
							try {entryName = utils.InputBox(window.ID, 'Enter name for menu entry\nWrite \'sep\' to add a line.', scriptName + ': ' + name, '', true);}
							catch (e) {return;}
							if (!entryName.length) {return;}
							if (entryName === 'sep') {input = {name: entryName};} // Add separator
							else { // or new entry
								let query = '';
								try {query = utils.InputBox(window.ID, 'Enter query:\nAlso allowed dynamic variables, like #ARTIST#, which will be replaced with focused item\'s value.', scriptName + ': ' + name, selArg.query, true);}
								catch (e) {return;}
								if (!query.length) {return;}
								let tfo = '';
								try {tfo = utils.InputBox(window.ID, 'Enter TF expression for sorting:', scriptName + ': ' + name, '', true);}
								catch (e) {return;}
								let direction = 1;
								try {direction = Number(utils.InputBox(window.ID, 'Direction:\n(-1 or 1)', scriptName + ': ' + name, 1, true));}
								catch (e) {return;}
								if (isNaN(direction)) {return;}
								direction = direction > 0 ? 1 : -1;
								input = {name: entryName, query, sort: {tfo, direction}};
								// Final check
								try {if (!do_dynamic_query({query, bSendToPls: false})) {throw 'error';}}
								catch (e) {fb.ShowPopupMessage('query not valid, check it and try again:\n' + query, scriptName);return;}
							}
							// Add entry
							queryFilter.push(input);
							// Save as property
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.properties['dynamicQueries'][1] = JSON.stringify(queryFilter); // And update property with new value
							// Presets
							if (!presets.hasOwnProperty('dynamicQueries')) {presets.dynamicQueries = [];}
							presets.dynamicQueries.push(input);
							args.properties['presets'][1] = JSON.stringify(presets);
							overwriteProperties(args.properties); // Updates panel
						}});
						{
							const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), menuName);
							queryFilter.forEach( (queryObj, index) => {
								const entryText = (queryObj.name === 'sep' ? '------(separator)------' : (queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name));
								menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
									queryFilter.splice(index, 1);
									args.properties['dynamicQueries'][1] = JSON.stringify(queryFilter);
									// Presets
									if (presets.hasOwnProperty('dynamicQueries')) {
										presets.dynamicQueries.splice(presets.dynamicQueries.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(queryObj);}), 1);
										if (!presets.dynamicQueries.length) {delete presets.dynamicQueries;}
										args.properties['presets'][1] = JSON.stringify(presets);
									}
									overwriteProperties(args.properties); // Updates panel
								}});
							});
							if (!queryFilter.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
							menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
							menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
								queryFilter = [...queryFilterDefaults];
								args.properties['dynamicQueries'][1] = JSON.stringify(queryFilter);
								// Presets
								if (presets.hasOwnProperty('dynamicQueries')) {
									delete presets.dynamicQueries;
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
							}});
						}
					}
				}});
			}
			menu.newEntry({entryText: 'sep'});
		} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
	}
}

// Similar by...Graph\Dyngenre\Weight
{
	const scriptPath = folders.xxx + 'main\\search_bydistance.js';
	if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
		const nameGraph = 'Search similar by Graph...';
		const nameDynGenre = 'Search similar by DynGenre...';
		const nameWeight = 'Search similar by Weight...';
		if (!menusEnabled.hasOwnProperty(nameGraph) || !menusEnabled.hasOwnProperty(nameDynGenre) || !menusEnabled.hasOwnProperty(nameWeight) || !menusEnabled.hasOwnProperty(specialMenu) || menusEnabled[nameGraph] === true || menusEnabled[nameDynGenre] === true || menusEnabled[nameWeight] === true || menusEnabled[specialMenu] === true) {
			include(scriptPath);
			readmes['Search similar by... (All)'] = folders.xxx + 'helpers\\readme\\search_bydistance.txt';
			readmes['Search similar by... (recipes\\themes)'] = folders.xxx + 'helpers\\readme\\search_bydistance_recipes_themes.txt';
			readmes['Search similar by Graph'] = folders.xxx + 'helpers\\readme\\search_bydistance_graph.txt';
			readmes['Search similar by Dyngenre'] = folders.xxx + 'helpers\\readme\\search_bydistance_dyngenre.txt';
			readmes['Search similar by Weight'] = folders.xxx + 'helpers\\readme\\search_bydistance_weight.txt';
			const selArgs = [
				{name: 'sep'},
				{name: 'Nearest Tracks', args: {genreWeight: 15, styleWeight: 10, moodWeight: 5, keyWeight: 10, dateWeight: 25, bpmWeight: 5,  dateRange: 15, 
					bpmRange: 25, probPick: 100, scoreFilter: 70}},
				{name: 'Similar Genre mix, within a decade', args: {genreWeight: 15, styleWeight: 10, moodWeight: 5, keyWeight: 5, dateWeight: 25, bpmWeight: 5,  dateRange: 15, bpmRange: 25, probPick: 100, scoreFilter: 70}},
				{name: 'Varied Styles/Genres mix, within a decade', args: {genreWeight: 0, styleWeight: 5, moodWeight: 15, keyWeight: 10, dateWeight: 25, bpmWeight: 5,  dateRange: 15, bpmRange: 25, probPick: 100, scoreFilter: 60}},
				{name: 'Random Styles/Genres mix, same Mood', args: {genreWeight: 0, styleWeight: 5, moodWeight: 15, keyWeight: 10, dateWeight: 0, bpmWeight: 5, 
					bpmRange: 25, probPick: 100, scoreFilter: 50}}
				];
			let similarBy = [
				];
			// Delete unused properties
			const toDelete = ['genreWeight', 'styleWeight', 'dyngenreWeight', 'dyngenreRange', 'moodWeight', 'keyWeight', 'keyRange', 'dateWeight', 'dateRange', 'bpmWeight', 'bpmRange', 'composerWeight', 'customStrWeight', 'customNumWeight', 'customNumRange', 'forcedQuery', 'bUseAntiInfluencesFilter', 'bUseInfluencesFilter', 'scoreFilter', 'sbd_max_graph_distance', 'method', 'bNegativeWeighting', 'poolFilteringTag', 'poolFilteringN', 'bRandomPick', 'probPick', 'playlistLength', 'bSortRandom', 'bScatterInstrumentals', 'bProgressiveListOrder', 'bInKeyMixingPlaylist', 'bProgressiveListCreation', 'ProgressiveListCreationN'];
			let toMerge = {}; // Deep copy
			Object.keys(SearchByDistance_properties).forEach( (key) => {
				if (toDelete.indexOf(key) === -1) {
					toMerge[key] = [...SearchByDistance_properties[key]];
					toMerge[key][0] = '\'Search similar\' ' + toMerge[key][0];
				}
			});
			// And merge
			menu_properties = {...menu_properties, ...toMerge};
			menu_properties['similarBy'] = ['Search similar by Graph\\Dyngenre\\Weight... args', JSON.stringify(similarBy)];
			// Set default args
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}], genreWeight: 0, styleWeight: 0, dyngenreWeight: 0, moodWeight: 0, keyWeight: 0, dateWeight: 0, bpmWeight: 0, composerWeight: 0, customStrWeight: 0, customNumWeight: 0, dyngenreRange: 0, keyRange: 0, dateRange: 0, bpmRange: 0, customNumRange: 0, bNegativeWeighting: true, bUseAntiInfluencesFilter: false, bUseInfluencesFilter: false, method: '', scoreFilter: 70, sbd_max_graph_distance: 100, poolFilteringTag: '', poolFilteringN: 3, bPoolFiltering: false, bRandomPick: true, probPick: 100, bSortRandom: true, bProgressiveListOrder: false, bScatterInstrumentals: true, bInKeyMixingPlaylist: false, bProgressiveListCreation: false, progressiveListCreationN: 3, bCreatePlaylist: true};
			// Menus
			function loadMenus(menuName, selArgs, entryArgs = []){
				selArgs.forEach( (selArg) => {
					if (selArg.name === 'sep') {
						let entryMenuName = selArg.hasOwnProperty('menu') ? selArg.menu : menuName;
						menu.newEntry({menuName: entryMenuName, entryText: 'sep'});
					} else {
						const entryArg = entryArgs.find((item) => {return item.name === selArg.name;}) || {};
						let entryText = selArg.name;
						menu.newEntry({menuName, entryText, func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg.args, ...entryArg.args}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							const globQuery = args.properties['forcedQuery'][1];
							if (args.hasOwnProperty('forcedQuery') && globQuery.length && args['forcedQuery'] !== globQuery) { // Join queries if needed
								args['forcedQuery'] =  globQuery + ' AND ' + args['forcedQuery'];
							}
							do_searchby_distance(args);
						}, flags: focusFlags});
					}
				});
			}
			function loadMenusCond(menuName, method){
				menu.newCondEntry({entryText: 'Search similar by Graph\\Dyngenre\\Weight... (cond)', condFunc: (args = {...scriptDefaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					similarBy = JSON.parse(args.properties.similarBy[1]);
					const entries = similarBy.map((item) => {
						if (!item.hasOwnProperty('method')) {
							item.method = method;
							if (item.hasOwnProperty('args')) {item.args.method = method;}
						}
						return item;
					}).filter((item) => {return item.method === method;});
					loadMenus(menuName, entries);
				}});
			}
			{	// Graph
				if (!menusEnabled.hasOwnProperty(nameGraph) || menusEnabled[nameGraph] === true) {
					let menuName = menu.newMenu(nameGraph);
					{	// Static menus
						menu.newEntry({menuName, entryText: 'Similar tracks by genre/style complex relations:', func: null, flags: MF_GRAYED});
						const distanceUnit = music_graph_descriptors.intra_supergenre; // 100
						const entryArgs = [
							{name: 'Nearest Tracks', args: {sbd_max_graph_distance: distanceUnit / 2, method: 'GRAPH'}}, // 50
							{name: 'Similar Genre mix, within a decade', args: {scoreFilter: 70, sbd_max_graph_distance: music_graph_descriptors.cluster, method: 'GRAPH'}}, // 85
							{name: 'Varied Styles/Genres mix, within a decade', args: {sbd_max_graph_distance: distanceUnit * 3/2, method: 'GRAPH'}}, //150
							{name: 'Random Styles/Genres mix, same Mood', args: {sbd_max_graph_distance: distanceUnit * 4, method: 'GRAPH'}} //400
						];
						loadMenus(menuName, selArgs, entryArgs);
						loadMenusCond(menuName, 'GRAPH');
					}
				} else {menuDisabled.push({menuName: nameGraph, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
			}
			{	// Dyngenre...
				if (!menusEnabled.hasOwnProperty(nameDynGenre) || menusEnabled[nameDynGenre] === true) {
					let menuName = menu.newMenu(nameDynGenre);
					{	// Static menus
						menu.newEntry({menuName, entryText: 'Similar tracks by genre/style simple grouping:', func: null, flags: MF_GRAYED});
						const distanceUnit = 1;
						const entryArgs = [
							{name: 'Nearest Tracks', args: {dyngenreWeight: 25, dyngenreRange: distanceUnit, method: 'DYNGENRE'}},
							{name: 'Similar Genre mix, within a decade', args: {dyngenreWeight: 10, dyngenreRange: distanceUnit, method: 'DYNGENRE'}},
							{name: 'Varied Styles/Genres mix, within a decade', args: {dyngenreWeight: 10, dyngenreRange: distanceUnit * 2, method: 'DYNGENRE'}},
							{name: 'Random Styles/Genres mix, same Mood', args: {dyngenreWeight: 5, dyngenreRange: distanceUnit * 4, method: 'DYNGENRE'}}
						];
						loadMenus(menuName, selArgs, entryArgs);
						loadMenusCond(menuName, 'DYNGENRE');
					}
				} else {menuDisabled.push({menuName: nameDynGenre, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
			}
			{	// Weight...
				if (!menusEnabled.hasOwnProperty(nameWeight) || menusEnabled[nameWeight] === true) {
					let menuName = menu.newMenu(nameWeight);
					{	// Static menus
						menu.newEntry({menuName, entryText: 'Similar tracks by tag matching scoring:', func: null, flags: MF_GRAYED});
						const entryArgs = [
							{name: 'Nearest Tracks', args: {method: 'WEIGHT'}},
							{name: 'Similar Genre mix, within a decade', args: {method: 'WEIGHT'}},
							{name: 'Varied Styles/Genres mix, within a decade', args: {method: 'WEIGHT'}},
							{name: 'Random Styles/Genres mix, same Mood', args: {method: 'WEIGHT'}}
						];
						loadMenus(menuName, selArgs, entryArgs);
						loadMenusCond(menuName, 'WEIGHT');
					}
				} else {menuDisabled.push({menuName: nameWeight, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
			}
			menu.newEntry({entryText: 'sep'});
			{	// -> Special playlists...
				if (!menusEnabled.hasOwnProperty(specialMenu) || menusEnabled[specialMenu] === true) {
					menu.newEntry({menuName: specialMenu, entryText: 'Based on Graph/Dyngenre/Weight:', func: null, flags: MF_GRAYED});
					const selArgs = [
						{name: 'sep'},
						{name: 'Influences from any date', args: {genreWeight: 5, styleWeight: 5, moodWeight: 15, keyWeight: 10, dateWeight: 0, bpmWeight: 10, bUseInfluencesFilter: true, probPick: 100, scoreFilter: 40, sbd_max_graph_distance: 500, method: 'GRAPH'}},
						{name: 'Influences within 20 years', args: {genreWeight: 5, styleWeight: 5, moodWeight: 15, keyWeight: 10, dateWeight: 10, dateRange: 20, bpmWeight: 10, bUseInfluencesFilter: true, probPick: 100, scoreFilter: 40, sbd_max_graph_distance: 500, method: 'GRAPH'}},
						{name: 'sep'},
						{name: 'Progressive playlist by genre/styles', args: {genreWeight: 15, styleWeight: 5, moodWeight: 30, keyWeight: 10, dateWeight: 5, dateRange: 35, bpmWeight: 10, probPick: 100, scoreFilter: 70, sbd_max_graph_distance: 200, method: 'GRAPH', bProgressiveListCreation: true, progressiveListCreationN: 3}},
						{name: 'Progressive playlist by mood', args: {genreWeight: 20, styleWeight: 20, moodWeight: 5, keyWeight: 20, dateWeight: 0, bpmWeight: 10, probPick: 100, scoreFilter: 60, sbd_max_graph_distance: 300, method: 'GRAPH', bProgressiveListCreation: true, progressiveListCreationN: 3}},
						{name: 'sep'},
						{name: 'Harmonic mix with similar genre/styles', args: {dyngenreWeight: 20, genreWeight: 15, styleWeight: 15, dyngenreRange: 2, keyWeight: 0, dateWeight: 5, dateRange: 25, scoreFilter: 70, method: 'DYNGENRE', 
							bInKeyMixingPlaylist: true}},
						{name: 'Harmonic mix with similar moods', args: {moodWeight: 35, genreWeight: 5, styleWeight: 5, dateWeight: 5, dateRange: 25, dyngenreWeight: 10, dyngenreRange: 3, keyWeight: 0, scoreFilter: 70, method: 'DYNGENRE', bInKeyMixingPlaylist: true}},
						{name: 'Harmonic mix with only instrumental tracks', args: {moodWeight: 15, genreWeight: 5, styleWeight: 5, dateWeight: 5, dateRange: 35, dyngenreWeight: 10, dyngenreRange: 3, keyWeight: 0, scoreFilter: 70, method: 'DYNGENRE', bInKeyMixingPlaylist: true, forcedQuery: 'GENRE IS Instrumental OR STYLE IS Instrumental'}}
						];
					// Menus
					function loadMenusCond(method){
						menu.newCondEntry({entryText: 'Special playlists... (cond)', condFunc: (args = {...scriptDefaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							similarBy = JSON.parse(args.properties.similarBy[1]);
							const entries = similarBy.filter((item) => {return item.method === method;});
							loadMenus(specialMenu, entries);
						}});
					}
					loadMenus(specialMenu, selArgs);
					loadMenusCond('SPECIAL');
				} else {menuDisabled.push({menuName: specialMenu, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
			}
			{	// -> Config menu
				if (!menusEnabled.hasOwnProperty(configMenu) || menusEnabled[configMenu] === true) {
					{
						const submenu = menu.newMenu('Search by Distance', configMenu);
						{ // Find genre/styles not on graph
							menu.newEntry({menuName: submenu, entryText: 'Find genres/styles not on Graph', func: (args = {...scriptDefaultArgs}) => {
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the pan
								// Skipped values at pre-filter
								const tagValuesExcluded = new Set(args.properties['genreStyleFilter'][1].split(',').filter(Boolean)); // Filter holes and remove duplicates
								// Get all tags and their frequency
								const tagsToCheck = [...new Set(args.properties['genreTag'][1].concat(',', args.properties['styleTag'][1]).split(',').filter(Boolean))]; // Merge and filter
								if (!tagsToCheck.length) {
									fb.ShowPopupMessage('There are no tags to check set at properties panel:\n' + args.properties['genreTag'][0], scriptName);
									return;
								}
								// Get tags
								const tags = new Set(getTagsValuesV4(fb.GetLibraryItems(), tagsToCheck, false, true).flat(Infinity));
								// Get node list (+ weak substitutions + substitutions + style cluster)
								const nodeList = new Set(music_graph_descriptors.style_supergenre.flat(Infinity)).union(new Set(music_graph_descriptors.style_weak_substitutions.flat(Infinity))).union(new Set(music_graph_descriptors.style_substitutions.flat(Infinity))).union(new Set(music_graph_descriptors.style_cluster.flat(Infinity)));
								// Compare (- user exclusions - graph exclusions)
								const missing = tags.difference(nodeList).difference(tagValuesExcluded).difference(music_graph_descriptors.map_distance_exclusions);
								// Report
								const userFile = folders.xxx + 'helpers\\music_graph_descriptors_xxx_user.js';
								const UserFileFound = (isCompatible('1.4.0') ? utils.IsFile(userFile) : utils.FileTest(userFile, 'e')) ? '' : ' (not found)';
								const UserFileEmpty = UserFileFound &&  Object.keys(music_graph_descriptors_user).length ? '' : ' (empty)';
								const report = 'Graph descriptors:\n' +
												'.\helpers\music_graph_descriptors_xxx.js\n' +
												'.\helpers\music_graph_descriptors_xxx_user.js' + UserFileFound + UserFileEmpty + '\n\n' +
												'List of tags not present on the graph descriptors:\n' +
												[...missing].sort().join(', ');
								fb.ShowPopupMessage(report, scriptName);
							}});
							// Graph debug
							menu.newEntry({menuName: submenu, entryText: 'Debug Graph (check console)', func: () => {
								if (bProfile) {var profiler = new FbProfiler('graphDebug');}
								graphDebug(all_music_graph);
								if (bProfile) {profiler.Print();}
							}});
							// Graph test
							menu.newEntry({menuName: submenu, entryText: 'Run distance tests (check console)', func: () => {
								if (bProfile) {var profiler = new FbProfiler('testGraph');}
								testGraph(all_music_graph);
								testGraphV2(all_music_graph);
								if (bProfile) {profiler.Print();}
							}});
							// Graph cache reset
							menu.newEntry({menuName: submenu, entryText: 'Reset link cache', func: () => {
								_deleteFile(folders.data + 'searchByDistance_cacheLink.json');
								_deleteFile(folders.data + 'searchByDistance_cacheLinkSet.json');
								cacheLink = void(0);
								cacheLinkSet = void(0);
								updateCache(); // Creates new one and also notifies other panels to discard their cache
							}});
						}
						menu.newEntry({menuName: submenu, entryText: 'sep'});
						{
							const submenuTwo = menu.newMenu('Tags...', submenu);
							{	// Menu to configure tags
								const options = ['genre', 'style', 'mood', 'bpm', 'key', 'composer', 'date', 'customStr', 'customNum'];
								const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
								menu.newEntry({menuName: submenuTwo, entryText: 'Tag remapping (only this tool):', func: null, flags: MF_GRAYED})
								menu.newEntry({menuName: submenuTwo, entryText: 'sep'})
								options.forEach((tagName) => {
									menu.newEntry({menuName: submenuTwo, entryText: capitalize(tagName), func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
										const key = tagName + 'Tag';
										const input = utils.InputBox(window.ID, 'Enter desired tag name(s):\n(In some cases merging multiple tags is allowed, check the readme)', scriptName + ': ' + configMenu, args.properties[key][1]);
										if (!input.length) {return;}
										if (args.properties[tagName + 'Tag'][1] === input) {return;}
										if (defaultArgs.hasOwnProperty(key)) {defaultArgs[key] = input;}
										args.properties[key][1] = input;
										overwriteProperties(args.properties); // Updates panel
									}});
								});
							}
						}
						menu.newEntry({menuName: submenu, entryText: 'sep'});
						{ // Create theme
							menu.newEntry({menuName: submenu, entryText: 'Create theme file with selected track', func: (args = {...scriptDefaultArgs}) => {
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel
								// Tag names
								const genreTag = args.properties['genreTag'][1].split(',').filter(Boolean);
								const styleTag = args.properties['styleTag'][1].split(',').filter(Boolean);
								const moodTag = args.properties['moodTag'][1].split(',').filter(Boolean);
								const dateTag = args.properties['dateTag'][1].split(',').filter(Boolean); // only allows 1 value, but put it into an array
								const composerTag = args.properties['composerTag'][1].split(',').filter(Boolean);
								const customStrTag = args.properties['customStrTag'][1].split(',').filter(Boolean);
								const customNumTag = args.properties['customNumTag'][1].split(',').filter(Boolean); // only allows 1 value, but put it into an array
								// Tag Values
								const selHandleList = new FbMetadbHandleList(fb.GetFocusItem());
								const genre = genreTag.length ? getTagsValuesV3(selHandleList, genreTag, true).flat().filter(Boolean) : [];
								const style = styleTag.length ? getTagsValuesV3(selHandleList, styleTag, true).flat().filter(Boolean) : [];
								const mood = moodTag.length ? getTagsValuesV3(selHandleList, moodTag, true).flat().filter(Boolean) : [];
								const composer = composerTag.length ? getTagsValuesV3(selHandleList, composerTag, true).flat().filter(Boolean) : [];
								const customStr = customStrTag.length ? getTagsValuesV3(selHandleList, customStrTag, true).flat().filter(Boolean) : [];
								const restTagNames = ['key', dateTag.length ? dateTag[0] : 'skip', 'bpm', customNumTag.length ? customNumTag[0] : 'skip']; // 'skip' returns empty arrays...
								const [keyArr, dateArr, bpmArr, customNumArr] = getTagsValuesV4(selHandleList, restTagNames).flat();
								const key = keyArr;
								const date = dateTag.length ? [Number(dateArr[0])] : [];
								const bpm = bpmArr.length ? [Number(bpmArr[0])] : [];
								const customNum = customNumTag.length ? [Number(customNumArr[0])] : [];
								// Theme obj
								let input = '';
								try {input = utils.InputBox(window.ID, 'Enter theme name', scriptName + ': ' + configMenu, 'my theme', true);}
								catch (e) {return;}
								if (!input.length) {return;}
								const theme = {name: input, tags: []};
								theme.tags.push({genre, style, mood, key, date, bpm, composer, customStr, customNum});
								const filePath = folders.xxx + 'presets\\Search by\\themes\\' + input + '.json';
								const bDone = _save(filePath, JSON.stringify(theme, null, '\t'));
								if (!bDone) {fb.ShowPopupMessage('Error saving theme file:' + filePath, scriptName + ': ' + name); return;}
							}, flags: focusFlags});
						}
						menu.newEntry({menuName: submenu, entryText: 'sep'});
						{ // Open descriptors
							menu.newEntry({menuName: submenu, entryText: 'Open main descriptor', func: () => {
								const file = folders.xxx + 'helpers\\music_graph_descriptors_xxx.js';
								if (isCompatible('1.4.0') ? utils.IsFile(file) : utils.FileTest(file, 'e')){_run('notepad.exe', file);}
							}});
							menu.newEntry({menuName: submenu, entryText: 'Open user descriptor', func: () => {
								const file = folders.xxx + 'helpers\\music_graph_descriptors_xxx_user.js';
								if (isCompatible('1.4.0') ? utils.IsFile(file) : utils.FileTest(file, 'e')){_run('notepad.exe', file);}
							}});
						}
						menu.newEntry({menuName: submenu, entryText: 'sep'});
						{ // Open graph html file
							menu.newEntry({menuName: submenu, entryText: 'Show Music Graph on Browser', func: () => {
								const file = folders.xxx + 'Draw Graph.html';
								if (isCompatible('1.4.0') ? utils.IsFile(file) : utils.FileTest(file, 'e')){_run(file);}
							}});
						}
					}
					menu.newEntry({menuName: configMenu, entryText: 'sep'});
				} else {menuDisabled.push({menuName: configMenu, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
			}
		} else {
			menuDisabled.push({menuName: nameGraph, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});
			menuDisabled.push({menuName: nameDynGenre, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});
			menuDisabled.push({menuName: nameWeight, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});
		}
	}
}

// Special Playlists...
{	// Create it if it was not already created. Contains entries from multiple scripts
	if (!menusEnabled.hasOwnProperty(specialMenu) || menusEnabled[specialMenu] === true) {
		if (!menu.hasMenu(specialMenu)) {
			menu.newMenu(specialMenu);
		}
		menu.newEntry({entryText: 'sep'});
	} else {menuDisabled.push({menuName: specialMenu, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

// Playlist manipulation...
{
	const name = 'Playlist manipulation';
	if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
		let menuName = menu.newMenu(name);
		{	// Remove Duplicates
			const scriptPath = folders.xxx + 'main\\remove_duplicates.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Duplicates and tag filtering';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\remove_duplicates.txt';
					let subMenuName = menu.newMenu(name, menuName);
					let sortInputDuplic = ['title', 'artist', 'date'];
					let sortInputFilter = ['title', 'artist', 'date'];
					let nAllowed = 2;
					// Create new properties with previous args
					menu_properties['sortInputDuplic'] = [menuName + '\\' + name + ' Tags to remove duplicates', sortInputDuplic.join(',')];
					menu_properties['sortInputFilter'] = [menuName + '\\' + name + ' Tags to filter playlists', sortInputFilter.join(',')];
					menu_properties['nAllowed'] = [menuName + '\\' + name + ' Filtering number allowed (n + 1)', nAllowed];
					// Checks
					menu_properties['nAllowed'].push({greaterEq: 0, func: Number.isSafeInteger}, menu_properties['nAllowed'][1]);
					// Merge
					const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
					// Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Filter playlists using tags or TF:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newCondEntry({entryText: 'Remove Duplicates... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						// Update args
						sortInputDuplic = args.properties.sortInputDuplic[1].split(',');
						sortInputFilter = args.properties.sortInputFilter[1].split(',');
						nAllowed = args.properties.nAllowed[1];
						// Menus
						menu.newEntry({menuName: subMenuName, entryText: 'Remove duplicates by ' + sortInputDuplic.join(', '), func: () => {do_remove_duplicatesV2(null, null, sortInputDuplic);}, flags: playlistCountFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'Filter playlist by ' + sortInputFilter.join(', ') + ' (n = ' + nAllowed + ')', func: () => {do_remove_duplicatesV3(null, null, sortInputFilter, nAllowed);}, flags: playlistCountFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText: 'Filter playlist by... (tags)' , func: () => {
							let tags;
							try {tags = utils.InputBox(window.ID, 'Enter list of tags separated by comma', scriptName + ': ' + name, sortInputDuplic.join(','), true);}
							catch (e) {return;}
							if (!tags.length) {return;}
							tags = tags.split(',').filter((val) => val);
							let n;
							try {n = Number(utils.InputBox(window.ID, 'Number of duplicates allowed (n + 1)', scriptName + ': ' + name, nAllowed, true));}
							catch (e) {return;}
							if (!Number.isSafeInteger(n)) {return;}
							do_remove_duplicatesV3(null, null, tags, n);
						}, flags: playlistCountFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText: 'Set tags (for duplicates)...', func: () => {
							const input = utils.InputBox(window.ID, 'Enter list of tags separated by comma', scriptName + ': ' + name, sortInputDuplic.join(','));
							if (sortInputDuplic.join(',') === input) {return;}
							if (!input.length) {return;}
							sortInputDuplic = input.split(',').filter((n) => n);
							args.properties['sortInputDuplic'][1] = sortInputDuplic.join(',');
							overwriteProperties(args.properties); // Updates panel
							updateShortcutsNames({sortInputDuplic: args.properties['sortInputDuplic'][1]});
						}});
						menu.newEntry({menuName: subMenuName, entryText: 'Set tags (for filtering)...', func: () => {
							const input = utils.InputBox(window.ID, 'Enter list of tags separated by comma', scriptName + ': ' + name, sortInputFilter.join(','));
							if (sortInputFilter.join(',') === input) {return;}
							if (!input.length) {return;}
							sortInputFilter = input.split(',').filter((n) => n);
							args.properties['sortInputFilter'][1] = sortInputFilter.join(',');
							overwriteProperties(args.properties); // Updates panel
							updateShortcutsNames({sortInputFilter: args.properties['sortInputFilter'][1], nAllowed});
						}});
						menu.newEntry({menuName: subMenuName, entryText: 'Set number allowed (for filtering)...', func: () => {
							const input = Number(utils.InputBox(window.ID, 'Number of duplicates allowed (n + 1)', scriptName + ': ' + name, nAllowed));
							if (nAllowed === input) {return;}
							if (!Number.isSafeInteger(input)) {return;}
							nAllowed = input;
							args.properties['nAllowed'][1] = nAllowed;
							overwriteProperties(args.properties); // Updates panel
							updateShortcutsNames({sortInputFilter: args.properties['sortInputFilter'][1], nAllowed});
						}});
					}});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Filter by Query
			const scriptPath = folders.xxx + 'main\\filter_by_query.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Query filtering';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\filter_by_query.txt';
					forcedQueryMenusEnabled[name] = false;
					const subMenuName = menu.newMenu(name, menuName);
					let queryFilter = [
							{name: 'Rating > 2', query: 'NOT (%rating% EQUAL 2 OR %rating% EQUAL 1)'}, 
							{name: 'Not live (none)', query: 'NOT STYLE IS Live'},  
							{name: 'Not live (except Hi-Fi)', query: 'NOT (STYLE IS Live AND NOT STYLE IS Hi-Fi)'},  
							{name: 'Not multichannel', query: '%channels% LESS 3 AND NOT COMMENT HAS Quad'}, 
							{name: 'Not SACD or DVD', query: 'NOT %_path% HAS .iso AND NOT CODEC IS MLP AND NOT CODEC IS DSD64 AND NOT CODEC IS DST64'}, 
							{name: 'Global forced query', query: defaultArgs['forcedQuery']},
							{name: 'sep'},
							{name: 'Same song than sel', query: 'ARTIST IS #ARTIST# AND TITLE IS #TITLE# AND DATE IS #DATE#'},
							{name: 'Same genre than sel', query: 'GENRE IS #GENRE#'},
							{name: 'Same key than sel', query: 'KEY IS #KEY#'},
							{name: 'sep'},
							{name: 'Different genre than sel', query: 'NOT GENRE IS #GENRE#'},
							{name: 'Different style than sel', query: 'NOT STYLE IS #STYLE#'}
					];
					let selArg = {name: 'Custom', query: queryFilter[0].query};
					const queryFilterDefaults = [...queryFilter];
					// Create new properties with previous args
					menu_properties['queryFilter'] = [menuName + '\\' + name + ' queries', JSON.stringify(queryFilter)];
					menu_properties['queryFilterCustomArg'] = [menuName + '\\' + name + ' Dynamic menu custom args', selArg.query];
					const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
					// Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Filter playlists using queries:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newCondEntry({entryText: 'Filter playlists using queries... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						queryFilter = JSON.parse(args.properties['queryFilter'][1]);
						queryFilter.forEach( (queryObj) => {
							if (queryObj.name === 'sep') { // Create separators
								menu.newEntry({menuName: subMenuName, entryText: 'sep'});
							} else { 
								// Create names for all entries
								const queryName = queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name;
								menu.newEntry({menuName: subMenuName, entryText: 'Filter playlist by ' + queryName, func: () => {
									let query = queryObj.query;
									// Forced query
									if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) { // With forced query enabled
										if (query.length && query.toUpperCase() !== 'ALL') { // ALL query never uses forced query!
											query = '(' + query + ') AND (' + args.forcedQuery + ')';
										} else if (!query.length) {query = args.forcedQuery;} // Empty uses forced query or ALL
									} else if (!query.length) {query = 'ALL';} // Otherwise empty is replaced with ALL
									// Test
									let focusHandle = fb.GetFocusItem(true);
									if (focusHandle && query.indexOf('#') !== -1) {query = queryReplaceWithCurrent(query, focusHandle);}
									try {fb.GetQueryItems(new FbMetadbHandleList(), query);}
									catch (e) {fb.ShowPopupMessage('Query not valid. Check it and add it again:\n' + query, scriptName); return;}
									// Execute
									do_filter_by_query(null, query);
								}, flags: playlistCountFlags});
							}
						});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText: 'Filter playlist by... (query)' , func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.query = selArg.query = args.properties['queryFilterCustomArg'][1];
							let input;
							try {input = utils.InputBox(window.ID, 'Enter query:\nAlso allowed dynamic variables, like #ARTIST#, which will be replaced with focused item\'s value.', scriptName + ': ' + name, args.query, true);}
							catch (e) {return;}
							// Forced query
							let query = input;
							if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) { // With forced query enabled
								if (query.length && query.toUpperCase() !== 'ALL') { // ALL query never uses forced query!
									query = '(' + query + ') AND (' + args.forcedQuery + ')';
								} else if (!query.length) {query = args.forcedQuery;} // Empty uses forced query or ALL
							} else if (!query.length) {query = 'ALL';} // Otherwise empty is replaced with ALL
							// Test
							let focusHandle = fb.GetFocusItem(true);
							if (focusHandle && query.indexOf('#') !== -1) {query = queryReplaceWithCurrent(query, focusHandle);}
							try {fb.GetQueryItems(new FbMetadbHandleList(), query);}
							catch (e) {fb.ShowPopupMessage('Query not valid. Check it and add it again:\n' + query, scriptName); return;}
							// Execute
							do_filter_by_query(null, query);
							// For internal use original object
							selArg.query = input; 
							args.properties['queryFilterCustomArg'][1] = query; // And update property with new value
							overwriteProperties(args.properties); // Updates panel
						}, flags: playlistCountFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText: 'Add new query to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							let input;
							let entryName;
							try {entryName = utils.InputBox(window.ID, 'Enter name for menu entr.\nWrite \'sep\' to add a line.', scriptName + ': ' + name, '', true);}
							catch (e) {return;}
							if (!entryName.length) {return;}
							if (entryName === 'sep') {input = {name: entryName};} // Add separator
							else {
								let query;
								try {query = utils.InputBox(window.ID, 'Enter query:\nAlso allowed dynamic variables, like #ARTIST#, which will be replaced with focused item\'s value.', scriptName + ': ' + name, '', true);}
								catch (e) {return;}
								if (query.indexOf('#') === -1) { // Try the query only if it is not a dynamic one
									try {fb.GetQueryItems(new FbMetadbHandleList(), query);}
									catch (e) {fb.ShowPopupMessage('Query not valid. Check it and add it again:\n' + query, scriptName); return;}
								}
								input = {name: entryName, query};
							}
							queryFilter.push(input);
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							args.properties['queryFilter'][1] = JSON.stringify(queryFilter);
							// Presets
							if (!presets.hasOwnProperty('queryFilter')) {presets.queryFilter = [];}
							presets.queryFilter.push(input);
							args.properties['presets'][1] = JSON.stringify(presets);
							overwriteProperties(args.properties); // Updates panel
						}});
						{
							const subMenuSecondName = menu.newMenu('Remove query from list...', subMenuName);
							queryFilter.forEach( (queryObj, index) => {
								const entryText = (queryObj.name === 'sep' ? '------(separator)------' : (queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name));
								menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
									queryFilter.splice(index, 1);
									args.properties['queryFilter'][1] = JSON.stringify(queryFilter);
									// Presets
									if (presets.hasOwnProperty('queryFilter')) {
										presets.queryFilter.splice(presets.queryFilter.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(queryObj);}), 1);
										if (!presets.queryFilter.length) {delete presets.queryFilter;}
										args.properties['presets'][1] = JSON.stringify(presets);
									}
									overwriteProperties(args.properties); // Updates panel
								}});
							});
							if (!queryFilter.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
							menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
							menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
								queryFilter = [...queryFilterDefaults];
								args.properties['queryFilter'][1] = JSON.stringify(queryFilter);
								// Presets
								if (presets.hasOwnProperty('queryFilter')) {
									delete presets.queryFilter;
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
							}});
						}
					}});
					menu.newEntry({menuName, entryText: 'sep'});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Create harmonic mix from playlist
			const scriptPath = folders.xxx + 'main\\harmonic_mixing.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Harmonic mix';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\harmonic_mixing.txt';
					const subMenuName = menu.newMenu(name, menuName);
					const selArgs = [
						{name: 'Harmonic mix from playlist'	, args: {selItems: () => {return plman.GetPlaylistItems(plman.ActivePlaylist);}}, flags: playlistCountFlags},
						{name: 'Harmonic mix from selection'	, args: {selItems: () => {return plman.GetPlaylistSelectedItems(plman.ActivePlaylist);}}, flags: multipleSelectedFlags},
					];
					// Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Using rule of Fifths (new playlist):', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					selArgs.forEach( (selArg) => {
						if (selArg.name === 'sep') {
							menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						} else {
							let entryText = selArg.name;
							menu.newEntry({menuName: subMenuName, entryText, func: (args = {...defaultArgs, ...selArg.args}) => {
								args.selItems = args.selItems();
								args.playlistLength = args.selItems.Count; // Max allowed
								if (bProfile) {var profiler = new FbProfiler('do_harmonic_mixing');}
								do_harmonic_mixing(args);
								if (bProfile) {profiler.Print();}
							}, flags: selArg.flags ? selArg.flags : undefined});
						}
					});
					menu.newEntry({menuName, entryText: 'sep'});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Find / New Playlist
			const name = 'Find or create playlist...';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				menu.newEntry({menuName, entryText: name, func: () => {
					let input;
					try {input = utils.InputBox(window.ID, 'Enter name:', scriptName + ': ' + name, 'New playlist', true);}
					catch (e) {return;}
					if (!input.length) {return;}
					plman.ActivePlaylist = plman.FindOrCreatePlaylist(input, false);
				}});
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
		{	// Crop playlist length (for use with macros!!)
			const name = 'Cut playlist length to...';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				const subMenuName = menu.newMenu(name, menuName);
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				const selArgs = [
					{name: '25 tracks', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, 25);}},
					{name: '50 tracks', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, 50);}},
					{name: '75 tracks', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, 75);}},
					{name: '100 tracks', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, 100);}},
					{name: 'sep'},
					{name: '25 tracks from end', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, -25);}},
					{name: '50 tracks from end', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, -50);}},
					{name: '75 tracks from end', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, -75);}},
					{name: '100 tracks from end', func: () => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, -100);}},
					{name: 'sep'},
					{name: (args = {...scriptDefaultArgs}) => {return 'Global Pls. Length: ' + getPropertiesPairs(args.properties[0], args.properties[1](), 0).playlistLength[1]}, func: (args = {...scriptDefaultArgs}) => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, getPropertiesPairs(args.properties[0], args.properties[1](), 0).playlistLength[1]);}},
					{name: (args = {...scriptDefaultArgs}) => {return 'Global pls. Length (end): ' + getPropertiesPairs(args.properties[0], args.properties[1](), 0).playlistLength[1]}, func: (args = {...scriptDefaultArgs}) => {plman.UndoBackup(plman.ActivePlaylist); removeNotSelectedTracks(plman.ActivePlaylist, -getPropertiesPairs(args.properties[0], args.properties[1](), 0).playlistLength[1]);}},
				];	
				menu.newEntry({menuName: subMenuName, entryText: 'Set playlist length to desired #:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				// Menus
				selArgs.forEach( (selArg) => {
					if (selArg.name === 'sep') {
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					} else {
						let entryText = selArg.name;
						menu.newEntry({menuName: subMenuName, entryText, func: (args = selArg.args) => {selArg.func(args)}, flags: playlistCountFlags});
					}
				});
				menu.newEntry({menuName, entryText: 'sep'});
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
		{	// Send Playlist to Playlist / Close playlist / Go to Playlist
			const nameSend = 'Send playlist\'s tracks to...';
			const nameGo = 'Go to playlist...';
			const nameClose = 'Close playlist...';
			if (!menusEnabled.hasOwnProperty(nameSend) || !menusEnabled.hasOwnProperty(nameGo) || !menusEnabled.hasOwnProperty(nameClose) || menusEnabled[nameSend] === true || menusEnabled[nameGo] === true || menusEnabled[nameClose] === true) {
				if (!menu_properties.hasOwnProperty('playlistSplitSize')) {
					menu_properties['playlistSplitSize'] = ['Playlist lists submenu size', 20];
					// Checks
					menu_properties['playlistSplitSize'].push({greater: 1, func: Number.isSafeInteger}, menu_properties['playlistSplitSize'][1]);
				}
				// Bools
				const bSend = !menusEnabled.hasOwnProperty(nameSend) || menusEnabled[nameSend] === true;
				const bGo = !menusEnabled.hasOwnProperty(nameGo) || menusEnabled[nameGo] === true;
				const bClose = !menusEnabled.hasOwnProperty(nameClose) || menusEnabled[nameClose] === true; 
				// Menus
				const subMenuNameSend = bSend ? menu.newMenu(nameSend, menuName) : null;
				const subMenuNameGo = bGo ? menu.newMenu(nameGo, menuName) : null;
				const subMenuNameClose = bClose ? menu.newMenu(nameClose, menuName) : null;
				if (bSend) {
					menu.newEntry({menuName: subMenuNameSend, entryText: 'Sends all tracks from current playlist to:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameSend, entryText: 'sep'});
				}
				if (bGo) {
					menu.newEntry({menuName: subMenuNameGo, entryText: 'Switch to another playlist:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameGo, entryText: 'sep'});
				}
				if (bClose) {
					menu.newEntry({menuName: subMenuNameClose, entryText: 'Close another playlist:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameClose, entryText: 'sep'});
				}
				// Buil submenus
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				menu.newCondEntry({entryText: 'Send/Go/Close to Playlists...', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					if (bProfile) {var profiler = new FbProfiler('Send/Go/Close to Playlists...');}
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					const playlistsNum = plman.PlaylistCount;
					const playlistsNumNotLocked = playlistCountNoLocked();
					if (playlistsNum && plman.PlaylistItemCount(plman.ActivePlaylist)) {
						// Split entries in sub-menus if there are too many playlists...
						let ss = args.properties['playlistSplitSize'][1];
						const splitBy =  bSend ? playlistsNumNotLocked < ss * 5 ? ss : ss * 2 : playlistsNum < ss * 5 ? ss : ss * 2; // Double split size when total exceeds 5 times the value (good enough for really high # of playlists)
						if (playlistsNum > splitBy) {
							const subMenusCount = bSend ? Math.ceil(playlistsNumNotLocked / splitBy) : Math.ceil(playlistsNum / splitBy);
							let skipped = 0; // Only used on bSend, to account for locked playlists
							for (let i = 0; i < subMenusCount; i++) {
								const bottomIdx =  i * splitBy;
								const topIdx = (i + 1) * splitBy - 1;
								// Prefix ID is required to avoid collisions with same sub menu names
								// Otherwise both menus would be called 'Playlist X-Y', leading to bugs (entries duplicated on both places)
								// Send
								const idxSend = bSend ? '(Send all to) Playlists ' + bottomIdx + ' - ' + topIdx : null;
								const subMenu_i_send = bSend ? menu.newMenu(idxSend, subMenuNameSend) : null;
								// Go to
								const idxGo = bGo ? '(Go to) Playlists ' + bottomIdx + ' - ' + topIdx : null;
								const subMenu_i_go = bGo ? menu.newMenu(idxGo, subMenuNameGo) : null;
								// Close
								const idxClose = bClose ? '(Close) Playlists ' + bottomIdx + ' - ' + topIdx : null;
								const subMenu_i_close = bClose ? menu.newMenu(idxClose, subMenuNameClose) : null;
								for (let j = bottomIdx; j <= topIdx + skipped && j < playlistsNum; j++) {
									const playlist = {name: plman.GetPlaylistName(j), index : j};
									if (bSend) {
										if (!plman.IsPlaylistLocked(j)) {
											menu.newEntry({menuName: subMenu_i_send, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
												plman.UndoBackup(playlist.index);
												plman.InsertPlaylistItems(playlist.index, plman.PlaylistItemCount(playlist.index), plman.GetPlaylistItems(plman.ActivePlaylist));
											}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
										} else {skipped++}
									}
									if (bGo) {
										menu.newEntry({menuName: subMenu_i_go, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
											plman.ActivePlaylist = playlist.index;
										}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
									}
									if (bClose) {
										menu.newEntry({menuName: subMenu_i_close, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
											plman.RemovePlaylist(playlist.index);
										}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
									}
								}
							}
						} else { // Or just show all
							for (let i = 0; i < playlistsNum; i++) {
								const playlist = {name: plman.GetPlaylistName(i), index : i};
								if (bSend) {
									if (!plman.IsPlaylistLocked(i)) {
										menu.newEntry({menuName: subMenuNameSend,  entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
											plman.InsertPlaylistItems(playlist.index, plman.PlaylistItemCount(playlist.index), plman.GetPlaylistItems(plman.ActivePlaylist));
										}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
									}
								}
								if (bGo) {
									menu.newEntry({menuName: subMenuNameGo, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
										plman.ActivePlaylist = playlist.index;
									}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
								}
								if (bClose) {
									menu.newEntry({menuName: subMenuNameClose, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
										plman.RemovePlaylist(playlist.index);
									}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
								}
							}
						}
					} else if (!playlistsNum) {
						if (bGo) {menu.newEntry({menuName: subMenuNameGo, entryText: 'No items.', func: null, flags: MF_GRAYED});}
						if (bClose) {menu.newEntry({menuName: subMenuNameClose, entryText: 'No items.', func: null, flags: MF_GRAYED});}
					} else if (!plman.PlaylistItemCount(plman.ActivePlaylist)) {
						if (bSend){menu.newEntry({menuName: subMenuNameSend, entryText: 'No items.', func: null, flags: MF_GRAYED});}
					}
					if (bProfile) {profiler.Print();}
				}});
			} else {
				menuDisabled.push({menuName: nameSend, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});
				menuDisabled.push({menuName: nameGo, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});
				menuDisabled.push({menuName: nameClose, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});
			}
		}
	} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

// Selection manipulation...
{
	const name = 'Selection manipulation';
	if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
		let menuName = menu.newMenu(name);
		{	// Legacy Sort
			const name = 'Sort...';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				const subMenuName = menu.newMenu(name, menuName);
				{	// Legacy Sort (for use with macros!!)
					const selArgs = [
						{name: 'Randomize', func: () => {plman.UndoBackup(plman.ActivePlaylist); plman.SortByFormat(plman.ActivePlaylist, '', true);}},
						{name: 'Reverse', func: () => {plman.UndoBackup(plman.ActivePlaylist); fb.RunMainMenuCommand('Edit/Selection/Sort/Reverse');}},
						{name: 'sep'}
					];
					let sortLegacy = [
						{name: 'Sort by Mood', tfo: '%mood%'},
						{name: 'Sort by Date', tfo: '%date%'},
						{name: 'Sort by BPM', tfo: '%bpm%'}
					];
					let selArg = {name: 'Custom', tfo: sortLegacy[0].tfo};
					const sortLegacyDefaults = [...sortLegacy];
					// Create new properties with previous args
					menu_properties['sortLegacy'] = [menuName + '\\' + name + '  entries', JSON.stringify(sortLegacy)];
					menu_properties['sortLegacyCustomArg'] = [menuName + '\\' + name + ' Dynamic menu custom args', JSON.stringify(selArg)];
					const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
					// Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Sort selection (legacy):', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					// Static menus
					selArgs.forEach( (selArg) => {
						if (selArg.name === 'sep') {
							menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						} else {
							let entryText = selArg.name;
							menu.newEntry({menuName: subMenuName, entryText, func: (args = selArg.args) => {selArg.func(args)}, flags: multipleSelectedFlags});
						}
					});
					menu.newCondEntry({entryText: 'Sort selection (legacy)... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						// Entry list
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						sortLegacy = JSON.parse(args.properties['sortLegacy'][1]);
						sortLegacy.forEach( (sortObj) => {
							// Add separators
							if (sortObj.hasOwnProperty('name') && sortObj.name === 'sep') {
								menu.newEntry({menuName: subMenuName, entryText: 'sep'});
							} else { 
								// Create names for all entries
								let sortName = sortObj.name;
								sortName = sortName.length > 40 ? sortName.substring(0,40) + ' ...' : sortName;
								// Entries
								menu.newEntry({menuName: subMenuName, entryText: sortName, func: () => {
									plman.UndoBackup(plman.ActivePlaylist);
									plman.SortByFormat(plman.ActivePlaylist, sortObj.tfo, true);
								}, flags: multipleSelectedFlags});
							}
						});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						{ // Static menu: user configurable
							menu.newEntry({menuName: subMenuName, entryText: 'By... (expression)', func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
								// On first execution, must update from property
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
								args.tfo = selArg.tfo = JSON.parse(args.properties['sortLegacyCustomArg'][1]).tfo;
								// Input
								let tfo;
								try {tfo = utils.InputBox(window.ID, 'Enter TF expression:', scriptName + ': ' + name, args.tfo, true);}
								catch (e) {return;}
								if (!tfo.length) {return;}
								// Execute
								plman.UndoBackup(plman.ActivePlaylist);
								plman.SortByFormat(plman.ActivePlaylist, tfo, true);
								// For internal use original object
								selArg.tfo = tfo;
								args.properties['sortLegacyCustomArg'][1] = JSON.stringify(selArg); // And update property with new value
								overwriteProperties(args.properties); // Updates panel
							}, flags: multipleSelectedFlags});
							// Menu to configure property
							menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						}
						{	// Add / Remove
							menu.newEntry({menuName: subMenuName, entryText: 'Add new entry to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
								// Input all variables
								let input;
								let entryName = '';
								try {entryName = utils.InputBox(window.ID, 'Enter name for menu entry\nWrite \'sep\' to add a line.', scriptName + ': ' + name, '', true);}
								catch (e) {return;}
								if (!entryName.length) {return;}
								if (entryName === 'sep') {input = {name: entryName};} // Add separator
								else { // or new entry
									let tfo = '';
									try {tfo = utils.InputBox(window.ID, 'Enter TF expression:', scriptName + ': ' + name, args.tfo, true);}
									catch (e) {return;}
									if (!tfo.length) {return;}
									input = {name: entryName, tfo};
								}
								// Add entry
								sortLegacy.push(input);
								// Save as property
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
								args.properties['sortLegacy'][1] = JSON.stringify(sortLegacy); // And update property with new value
								// Presets
								if (!presets.hasOwnProperty('sortLegacy')) {presets.sortLegacy = [];}
								presets.sortLegacy.push(input);
								args.properties['presets'][1] = JSON.stringify(presets);
								overwriteProperties(args.properties); // Updates panel
							}});
							{
								const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), subMenuName);
								sortLegacy.forEach( (sortObj, index) => {
									const entryText = (sortObj.name === 'sep' ? '------(separator)------' : (sortObj.name.length > 40 ? sortObj.name.substring(0,40) + ' ...' : sortObj.name));
									menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
										sortLegacy.splice(index, 1);
										args.properties['sortLegacy'][1] = JSON.stringify(sortLegacy);
										// Presets
										if (presets.hasOwnProperty('sortLegacy')) {
											presets.sortLegacy.splice(presets.sortLegacy.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(sortObj);}), 1);
											if (!presets.sortLegacy.length) {delete presets.sortLegacy;}
											args.properties['presets'][1] = JSON.stringify(presets);
										}
										overwriteProperties(args.properties); // Updates panel
									}});
								});
								if (!sortLegacy.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
								menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
								menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
									sortLegacy = [...sortLegacyDefaults];
									args.properties['sortLegacy'][1] = JSON.stringify(sortLegacy);
									// Presets
									if (presets.hasOwnProperty('sortLegacy')) {
										delete presets.sortLegacy;
										args.properties['presets'][1] = JSON.stringify(presets);
									}
									overwriteProperties(args.properties); // Updates panel
								}});
							}
						}
					}});
				}
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
		{	// Advanced Sort
			const name = 'Advanced sort...';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				// Menus
				const subMenuName = menu.newMenu(name, menuName);
				menu.newEntry({menuName: subMenuName, entryText: 'Sort selection (algorithm):', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				const selArgs = [];
				{	// Sort by key
					const scriptPath = folders.xxx + 'main\\sort_by_key.js';
					if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
						include(scriptPath);
						readmes[name + '\\' + 'Sort by Key'] = folders.xxx + 'helpers\\readme\\sort_by_key.txt';
						if (selArgs.length) {selArgs.push({name: 'sep'});}
						[
							{name: 'Incremental key (Camelot Wheel)', 	func: do_sort_by_key, args: {sortOrder: 1}},
							{name: 'Decremental key (Camelot Wheel)',	func: do_sort_by_key, args: {sortOrder: -1}},
						].forEach((val) => {selArgs.push(val);});
					}
				}
				{	// Sort by DynGenre
					const scriptPath = folders.xxx + 'main\\sort_by_dyngenre.js';
					if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
						include(scriptPath);
						readmes[name + '\\' + 'Sort by DynGenre'] = folders.xxx + 'helpers\\readme\\sort_by_dyngenre.txt';
						if (selArgs.length) {selArgs.push({name: 'sep'});}
						[
							{name: 'Incremental genre/styles (DynGenre)', func: do_sort_by_dyngenre, args: {sortOrder: 1}},
						].forEach((val) => {selArgs.push(val);});
					}
				}
				// Menus
				selArgs.forEach( (selArg) => {
					if (selArg.name === 'sep') {
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					} else {
						let entryText = selArg.name;
						menu.newEntry({menuName: subMenuName, entryText, func: (args = {...defaultArgs, ...selArg.args}) => {selArg.func(args);}, flags: multipleSelectedFlags});
					}
				});
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
		{	// Scatter
			const scriptPath = folders.xxx + 'main\\scatter_by_tags.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Scatter by tags';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\scatter_by_tags.txt';
					const subMenuName = menu.newMenu(name, menuName);
					const selArgs = [
						{name: 'Scatter instrumental tracks'	, 	args: {tagName: 'genre,style', tagValue: 'Instrumental,Jazz,Instrumental Rock'}},
						{name: 'Scatter acoustic tracks'		, 	args: {tagName: 'genre,style,mood', tagValue: 'Acoustic'}},
						{name: 'Scatter electronic tracks'		,	args: {tagName: 'genre,style', tagValue: 'Electronic'}},
						{name: 'Scatter female vocal tracks'	,	args: {tagName: 'genre,style', tagValue: 'Female Vocal'}},
						{name: 'sep'},
						{name: 'Scatter sad mood tracks'		,	args: {tagName: 'mood', tagValue: 'Sad'}},
						{name: 'Scatter aggressive mood tracks', 	args: {tagName: 'mood', tagValue: 'Aggressive'}},
					];
					// Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Reorder selection according to tags:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					selArgs.forEach( (selArg) => {
						if (selArg.name === 'sep') {
							menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						} else {
							let entryText = selArg.name;
							menu.newEntry({menuName: subMenuName, entryText, func: (args = {...defaultArgs, ...selArg.args}) => {
								do_scatter_by_tags(args);
							}, flags: multipleSelectedFlags});
						}
					});
					menu.newEntry({menuName, entryText: 'sep'});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Remove and find in playlists
			const scriptPath = folders.xxx + 'main\\find_remove_from_playlists.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const nameNowFind = 'Find now playing track in...';
				const nameFind = 'Find track(s) in...';
				const nameRemove = 'Remove track(s) from...';
				if (!menusEnabled.hasOwnProperty(nameNowFind) || !menusEnabled.hasOwnProperty(nameFind) || !menusEnabled.hasOwnProperty(nameRemove) || menusEnabled[nameNowFind] === true || menusEnabled[nameFind] === true || menusEnabled[nameRemove] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + 'Find in and Remove from'] = folders.xxx + 'helpers\\readme\\find_remove_from_playlists.txt';
					// Add properties
					menu_properties['bFindShowCurrent'] = ['\'Tools\\Find track(s) in...\' show current playlist?', true];
					menu_properties['bRemoveShowLocked'] = ['\'Tools\\Remove track(s) from...\' show autoplaylists?', true];
					menu_properties['findRemoveSplitSize'] = ['\'Tools\\Find track(s) in...\' list submenu size', 10];
					menu_properties['maxSelCount'] = ['\'Tools\\Find  & Remove track(s)...\' max. track selection', 25];
					// Checks
					menu_properties['bFindShowCurrent'].push({func: isBoolean}, menu_properties['bFindShowCurrent'][1]);
					menu_properties['bRemoveShowLocked'].push({func: isBoolean}, menu_properties['bRemoveShowLocked'][1]);
					menu_properties['findRemoveSplitSize'].push({greater: 1, func: Number.isSafeInteger}, menu_properties['findRemoveSplitSize'][1]);
					menu_properties['maxSelCount'].push({greater: 0, func: Number.isSafeInteger}, menu_properties['maxSelCount'][1]);
					// Menus
					{	// Find now playing in
						if (!menusEnabled.hasOwnProperty(nameNowFind) || menusEnabled[nameNowFind] === true) {
							const subMenuName = menu.newMenu(nameNowFind, menuName);
							const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
							menu.newCondEntry({entryText: 'Find now playing track in... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
								if (bProfile) {var profiler = new FbProfiler('Find now playing in');}
								menu.newEntry({menuName: subMenuName, entryText: 'Set focus on playlist with now playing track:', func: null, flags: MF_GRAYED});
								menu.newEntry({menuName: subMenuName, entryText: 'sep'});
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
								const nowPlay = fb.GetNowPlaying();
								if (!nowPlay) {menu.newEntry({menuName: subMenuName, entryText: 'Playback is stopped (no playing track)', func: null, flags: MF_GRAYED}); return;}
								const sel = new FbMetadbHandleList(nowPlay);
								var inPlaylist = findInPlaylists(sel);
								const bShowCurrent = args.properties['bFindShowCurrent'][1];
								if (!bShowCurrent) {inPlaylist = inPlaylist.filter((playlist) => {return plman.ActivePlaylist !== playlist.index;});}
								const playlistsNum = inPlaylist.length;
								if (playlistsNum) {
									// Split entries in sub-menus if there are too many playlists...
									let ss = args.properties['findRemoveSplitSize'][1];
									const splitBy = playlistsNum < ss * 5 ? ss : ss * 2; // Double split size when total exceeds 5 times the value (good enough for really high # of playlists)
									if (playlistsNum > splitBy) {
										const subMenusCount = Math.ceil(playlistsNum / splitBy);
										for (let i = 0; i < subMenusCount; i++) {
											const bottomIdx =  i * splitBy;
											const topIdx = (i + 1) * splitBy - 1;
											const idx = 'Playlists ' + bottomIdx + ' - ' + topIdx + nextId('invisible', true, false);
											// Invisible ID is required to avoid collisions with same sub menu name at 'Find track(s) in...'
											// Otherwise both menus would be called 'Playlist X-Y', leading to bugs (entries duplicated on both places)
											const subMenu_i = menu.newMenu(idx, subMenuName);
											for (let j = bottomIdx; j <= topIdx && j < playlistsNum; j++) {
												const playlist = inPlaylist[j];
												menu.newEntry({menuName: subMenu_i, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {focusInPlaylist(sel, playlist.index);}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
											}
										}
									} else { // Or just show all
										for (const playlist of inPlaylist) {
											menu.newEntry({menuName: subMenuName,  entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {focusInPlaylist(sel, playlist.index);}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
										}
									}
								} else {
									menu.newEntry({menuName: subMenuName, entryText: 'Not found', func: null, flags: MF_GRAYED});
								}
								if (bProfile) {profiler.Print();}
							}});
						} else {menuDisabled.push({menuName: nameNowFind, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
					}
					{	// Find in Playlists
						if (!menusEnabled.hasOwnProperty(nameFind) || menusEnabled[nameFind] === true) {
							const subMenuName = menu.newMenu(nameFind, menuName);
							const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
							menu.newCondEntry({entryText: 'Find track(s) in... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
								if (bProfile) {var profiler = new FbProfiler('Find in Playlists');}
								menu.newEntry({menuName: subMenuName, entryText: 'Set focus on playlist with same track(s):', func: null, flags: MF_GRAYED});
								menu.newEntry({menuName: subMenuName, entryText: 'sep'});
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
								const sel = plman.GetPlaylistSelectedItems(plman.ActivePlaylist);
								const maxSelCount = args.properties['maxSelCount'][1]; // Don't create these menus when selecting more than these # tracks! Avoids lagging when creating the menu
								if (sel.Count > maxSelCount) {menu.newEntry({menuName: subMenuName, entryText: 'Too many tracks selected: > ' + maxSelCount, func: null, flags: MF_GRAYED}); return;}
								var inPlaylist = findInPlaylists(sel);
								const bShowCurrent = args.properties['bFindShowCurrent'][1];
								if (!bShowCurrent) {inPlaylist = inPlaylist.filter((playlist) => {return plman.ActivePlaylist !== playlist.index;});}
								const playlistsNum = inPlaylist.length;
								if (playlistsNum) {
									// Split entries in sub-menus if there are too many playlists...
									let ss = args.properties['findRemoveSplitSize'][1];
									const splitBy = playlistsNum < ss * 5 ? ss : ss * 2; // Double split size when total exceeds 5 times the value (good enough for really high # of playlists)
									if (playlistsNum > splitBy) {
										const subMenusCount = Math.ceil(playlistsNum / splitBy);
										for (let i = 0; i < subMenusCount; i++) {
											const bottomIdx =  i * splitBy;
											const topIdx = (i + 1) * splitBy - 1;
											const idx = 'Playlists ' + bottomIdx + ' - ' + topIdx + nextId('invisible', true, false);
											// Invisible ID is required to avoid collisions with same sub menu name at 'Find track(s) in...'
											// Otherwise both menus would be called 'Playlist X-Y', leading to bugs (entries duplicated on both places)
											const subMenu_i = menu.newMenu(idx, subMenuName);
											for (let j = bottomIdx; j <= topIdx && j < playlistsNum; j++) {
												const playlist = inPlaylist[j];
												menu.newEntry({menuName: subMenu_i, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : ''), func: () => {focusInPlaylist(sel, playlist.index);}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
											}
										}
									} else { // Or just show all
										for (const playlist of inPlaylist) {
											menu.newEntry({menuName: subMenuName, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : ''), func: () => {focusInPlaylist(sel, playlist.index);}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
										}
									}
								} else {
									menu.newEntry({menuName: subMenuName, entryText: 'Not found', func: null, flags: MF_GRAYED});
								}
								if (bProfile) {profiler.Print();}
							}});
						} else {menuDisabled.push({menuName: nameFind, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
					}
					{	// Remove from Playlists
						if (!menusEnabled.hasOwnProperty(nameRemove) || menusEnabled[nameRemove] === true) {
							const subMenuName = menu.newMenu(nameRemove, menuName);
							const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
							menu.newCondEntry({entryText: 'Remove track(s) from... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
								if (bProfile) {var profiler = new FbProfiler('Remove from Playlists');}
								menu.newEntry({menuName: subMenuName, entryText: 'Remove track(s) from selected playlist:', func: null, flags: MF_GRAYED});
								menu.newEntry({menuName: subMenuName, entryText: 'sep'});
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
								const sel = plman.GetPlaylistSelectedItems(plman.ActivePlaylist);
								const maxSelCount = args.properties['maxSelCount'][1]; // Don't create these menus when selecting more than these # tracks! Avoids lagging when creating the menu
								if (sel.Count > maxSelCount) {menu.newEntry({menuName: subMenuName, entryText: 'Too many tracks selected: > ' + maxSelCount, func: null, flags: MF_GRAYED}); return;}
								var inPlaylist = findInPlaylists(sel);
								const bShowLocked = args.properties['bRemoveShowLocked'][1];
								if (!bShowLocked) {inPlaylist = inPlaylist.filter((playlist) => {return !playlist.bLocked})}
								const playlistsNum = inPlaylist.length ;
								if (playlistsNum) {
									// Split entries in sub-menus if there are too many playlists...
									let ss = args.properties['findRemoveSplitSize'][1];
									const splitBy = playlistsNum < ss * 5 ? ss : ss * 2; // Double split size when total exceeds 5 times the value (good enough for really high # of playlists)
									if (playlistsNum > splitBy) {
										const subMenusCount = Math.ceil(playlistsNum / splitBy);
										for (let i = 0; i < subMenusCount; i++) {
											const bottomIdx =  i * splitBy;
											const topIdx = (i + 1) * splitBy - 1;
											const idx = 'Playlists ' + bottomIdx + ' - ' + topIdx + nextId('invisible', true, false);
											// Invisible ID is required to avoid collisions with same sub menu name at 'Find track(s) in...'
											// Otherwise both menus would be called 'Playlist X-Y', leading to bugs (entries duplicated on both places)
											const subMenu_i = menu.newMenu(idx, subMenuName);
											for (let j = bottomIdx; j <= topIdx && j < playlistsNum; j++) {
												const playlist = inPlaylist[j];
												const playlistName =  playlist.name + (playlist.bLocked ? ' (locked playlist)' : '') + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '')
												menu.newEntry({menuName: subMenu_i, entryText: playlistName, func: () => {plman.UndoBackup(playlist.index); removeFromPlaylist(sel, playlist.index);}, flags: playlist.bLocked ? MF_GRAYED : MF_STRING});
											}
										}
									} else { // Or just show all
										for (const playlist of inPlaylist) {
											const playlistName =  playlist.name + (playlist.bLocked ? ' (locked playlist)' : '') + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '')
											menu.newEntry({menuName: subMenuName, entryText: playlistName, func: () => {plman.UndoBackup(playlist.index); removeFromPlaylist(sel, playlist.index);}, flags: playlist.bLocked ? MF_GRAYED : MF_STRING});
										}
									}
								} else {
									menu.newEntry({menuName: subMenuName, entryText: 'Not found', func: null, flags: MF_GRAYED});
								}
								if (bProfile) {profiler.Print();}
							}});
						} else {menuDisabled.push({menuName: nameRemove, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
					}
					{	// Configure properties
						if (!menusEnabled.hasOwnProperty(configMenu) || menusEnabled[configMenu] === true) {
							const subMenuName = menu.newMenu('Tools\\Find in and Remove from...', configMenu);
							{	// bFindShowCurrent (Find in Playlists)
								if (!menusEnabled.hasOwnProperty(nameFind) || menusEnabled[nameFind] === true) {
									const subMenuSecondName = menu.newMenu('Show current playlist?', subMenuName);
									const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
									const options = ['Yes (greyed entry)', 'No (omit it)'];	
									menu.newEntry({menuName: subMenuSecondName, entryText: 'Only on \'Find track(s) in...\':', func: null, flags: MF_GRAYED});
									menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
									menu.newEntry({menuName: subMenuSecondName, entryText: options[0], func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
										args.properties['bFindShowCurrent'][1] = true;
										overwriteProperties(args.properties); // Updates panel
									}});
									menu.newEntry({menuName: subMenuSecondName, entryText: options[1], func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
										args.properties['bFindShowCurrent'][1] = false;
										overwriteProperties(args.properties); // Updates panel
									}});
									menu.newCheckMenu(subMenuSecondName, options[0], options[1],  (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
										return (args.properties['bFindShowCurrent'][1] ? 0 : 1);
									});
								}
							}
							{	// bRemoveShowLocked (Remove from Playlists)
								if (!menusEnabled.hasOwnProperty(nameRemove) || menusEnabled[nameRemove] === true) {
									const subMenuSecondName = menu.newMenu('Show locked playlist (autoplaylists, etc.)?', subMenuName);
									const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
									const options = ['Yes (locked, greyed entries)', 'No (omit them)'];	
									menu.newEntry({menuName: subMenuSecondName, entryText: 'Only on \'Remove track(s) from...\':', func: null, flags: MF_GRAYED});
									menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
									menu.newEntry({menuName: subMenuSecondName, entryText: options[0], func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
										args.properties['bRemoveShowLocked'][1] = true;
										overwriteProperties(args.properties); // Updates panel
									}});
									menu.newEntry({menuName: subMenuSecondName, entryText: options[1], func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
										args.properties['bRemoveShowLocked'][1] = false;
										overwriteProperties(args.properties); // Updates panel
									}});
									menu.newCheckMenu(subMenuSecondName, options[0], options[1],  (args = {...scriptDefaultArgs, ...defaultArgs}) => {
										args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
										return (args.properties['bRemoveShowLocked'][1] ? 0 : 1);
									});
								}
							}
							{	// findRemoveSplitSize ( Find in / Remove from Playlists)
								const subMenuSecondName = menu.newMenu('Split playlist list submenus at...', subMenuName);
								const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
								const options = [5, 10, 20, 30, 'Other...'];
								const optionsIdx = [...options]; // Invisible ID added later is required to avoid collisions
								options.forEach( (val, index) => { // Creates menu entries for all options
									if (index === 0) {
										menu.newEntry({menuName: subMenuSecondName, entryText: 'Number of entries:', func: null, flags: MF_GRAYED});
										menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
									}
									const idx = val + nextId('invisible', true, false); // Invisible ID is required to avoid collisions
									optionsIdx[index] = idx; // For later use
									if (index !== options.length - 1) { // Predefined sizes
										menu.newEntry({menuName: subMenuSecondName, entryText: idx, func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
											args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
											args.properties['findRemoveSplitSize'][1] = val;
											overwriteProperties(args.properties); // Updates panel
										}});
									} else { // Last one is user configurable
										menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
										menu.newEntry({menuName: subMenuSecondName, entryText: idx, func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
											args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
											const input = Number(utils.InputBox(window.ID, 'Enter desired Submenu max size.\n', scriptName + ': ' + subMenuName, args.properties['findRemoveSplitSize'][1]));
											if (args.properties['findRemoveSplitSize'][1] === input) {return;}
											if (!Number.isSafeInteger(input)) {return;}
											args.properties['findRemoveSplitSize'][1] = input;
											overwriteProperties(args.properties); // Updates panel
										}});
									}
								});
								menu.newCheckMenu(subMenuSecondName, optionsIdx[0], optionsIdx[optionsIdx.length - 1],  (args = {...scriptDefaultArgs, ...defaultArgs}) => {
									args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel
									const size = options.indexOf(args.properties['findRemoveSplitSize'][1]);
									return (size !== -1 ? size : options.length - 1);
								});
							}
							{	// maxSelCount ( Find in / Remove from Playlists)
								const subMenuSecondName = menu.newMenu('Don\'t try to find tracks if selecting more than...', subMenuName);
								const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
								const options = [5, 10, 20, 25, 'Other...'];
								const optionsIdx = [...options]; // Invisible ID added later is required to avoid collisions
								options.forEach( (val, index) => { // Creates menu entries for all options
									if (index === 0) {
										menu.newEntry({menuName: subMenuSecondName, entryText: 'Number of tracks:', func: null, flags: MF_GRAYED});
										menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
									}
									const idx = val + nextId('invisible', true, false); // Invisible ID is required to avoid collisions
									optionsIdx[index] = idx; // For later use
									if (index !== options.length - 1) { // Predefined sizes
										menu.newEntry({menuName: subMenuSecondName, entryText: idx, func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
											args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
											args.properties['maxSelCount'][1] = val;
											overwriteProperties(args.properties); // Updates panel
										}});
									} else { // Last one is user configurable
										menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
										menu.newEntry({menuName: subMenuSecondName, entryText: idx, func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
											args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
											const input = Number(utils.InputBox(window.ID, 'Enter max number of tracks.\n', scriptName + ': ' + subMenuName, args.properties['maxSelCount'][1]));
											if (args.properties['maxSelCount'][1] === input) {return;}
											if (!Number.isSafeInteger(input)) {return;}
											args.properties['maxSelCount'][1] = input;
											overwriteProperties(args.properties); // Updates panel
										}});
									}
								});
								menu.newCheckMenu(subMenuSecondName, optionsIdx[0], optionsIdx[optionsIdx.length - 1],  (args = {...scriptDefaultArgs, ...defaultArgs}) => {
									args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel
									const size = options.indexOf(args.properties['maxSelCount'][1]);
									return (size !== -1 ? size : options.length - 1);
								});
							}
							menu.newEntry({menuName: configMenu, entryText: 'sep'});
						} else {menuDisabled.push({menuName: configMenu, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
					}
				} else {
					menuDisabled.push({menuName: nameNowFind, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});
					menuDisabled.push({menuName: nameFind, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});
					menuDisabled.push({menuName: nameRemove, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});
				}
			}
		}
		{	// Send Selection to Playlist
			const name = 'Send selection to...';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				include(folders.xxx + 'helpers\\helpers_xxx_playlists.js');
				// Add properties
				if (!menu_properties.hasOwnProperty('playlistSplitSize')) {
					menu_properties['playlistSplitSize'] = ['Playlist lists submenu size', 20];
					// Checks
					menu_properties['playlistSplitSize'].push({greater: 1, func: Number.isSafeInteger}, menu_properties['playlistSplitSize'][1]);
				}
				// Menus
				const subMenuNameSend = menu.newMenu(name, menuName);
				menu.newEntry({menuName: subMenuNameSend, entryText: 'Sends all tracks from current playlist to:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameSend, entryText: 'sep'});
				// Build submenus
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				menu.newCondEntry({entryText: 'Send selection to...', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					if (bProfile) {var profiler = new FbProfiler('Send selection to...');}
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					const playlistsNum = plman.PlaylistCount;
					const playlistsNumNotLocked = playlistCountNoLocked();
					const handleList = plman.GetPlaylistSelectedItems(plman.ActivePlaylist);
					if (playlistsNum && playlistsNumNotLocked && handleList.Count) {
						// Split entries in sub-menus if there are too many playlists...
						let ss = args.properties['playlistSplitSize'][1];
						const splitBy = playlistsNumNotLocked < ss * 5 ? ss : ss * 2; // Double split size when total exceeds 5 times the value (good enough for really high # of playlists)
						if (playlistsNumNotLocked > splitBy) {
							const subMenusCount = Math.ceil(playlistsNumNotLocked / splitBy);
							let skipped = 0; // To account for locked playlists
							for (let i = 0; i < subMenusCount; i++) {
								const bottomIdx =  i * splitBy;
								const topIdx = (i + 1) * splitBy - 1;
								// Invisible ID is required to avoid collisions with same sub menu name at 'Find track(s) in...'
								// Otherwise both menus would be called 'Playlist X-Y', leading to bugs (entries duplicated on both places)
								// Send
								const idxSend = '(Send sel. to) Playlists ' + bottomIdx + ' - ' + topIdx;
								const subMenu_i_send = menu.newMenu(idxSend, subMenuNameSend);
								for (let j = bottomIdx; j <= topIdx + skipped && j < playlistsNum; j++) {
									if (!plman.IsPlaylistLocked(j)) {
										const playlist = {name: plman.GetPlaylistName(j), index : j};
										menu.newEntry({menuName: subMenu_i_send, entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
											plman.UndoBackup(playlist.index);
											plman.InsertPlaylistItems(playlist.index, plman.PlaylistItemCount(playlist.index), handleList);
										}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
									} else {skipped++}
								}
							}
						} else { // Or just show all
							for (let i = 0; i < playlistsNum; i++) {
								if (!plman.IsPlaylistLocked(i)) {
									const playlist = {name: plman.GetPlaylistName(i), index : i};
									menu.newEntry({menuName: subMenuNameSend,  entryText: playlist.name + (plman.ActivePlaylist === playlist.index ? ' (current playlist)' : '') +  (plman.PlayingPlaylist === playlist.index ? ' (playing playlist)' : ''), func: () => {
										plman.InsertPlaylistItems(playlist.index, plman.PlaylistItemCount(playlist.index), handleList);
									}, flags: (plman.ActivePlaylist === playlist.index ? MF_GRAYED : MF_STRING)});
								}
							}
						}
					} else {
						menu.newEntry({menuName: subMenuNameSend, entryText: 'No items.', func: null, flags: MF_GRAYED});
					}
					if (bProfile) {profiler.Print();}
				}});
				menu.newEntry({menuName, entryText: 'sep'});
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
		{	// Select (for use with macros!!)
			const name = 'Select...';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				const subMenuName = menu.newMenu(name, menuName);
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				menu.newEntry({menuName: subMenuName, entryText: 'Sets selection on current playlist:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Select All', func: () => {
					const start = 0;
					const end = plman.PlaylistItemCount(plman.ActivePlaylist);
					plman.ClearPlaylistSelection(plman.ActivePlaylist);
					plman.SetPlaylistSelection(plman.ActivePlaylist, range(start, end, 1), true);
				}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'Clear selection', func: () => {plman.ClearPlaylistSelection(plman.ActivePlaylist);}, flags: selectedFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Select first track', func: () => {
					plman.ClearPlaylistSelection(plman.ActivePlaylist);
					plman.SetPlaylistSelection(plman.ActivePlaylist, [0], true);
				}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'Select last track', func: () => {
					plman.ClearPlaylistSelection(plman.ActivePlaylist);
					plman.SetPlaylistSelection(plman.ActivePlaylist, [plman.PlaylistItemCount(plman.ActivePlaylist) - 1], true);
				}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Select random track', func: () => {
					const numbers = range(0, plman.PlaylistItemCount(plman.ActivePlaylist), 1).shuffle(); // Get indexes randomly sorted
					plman.ClearPlaylistSelection(plman.ActivePlaylist);
					plman.SetPlaylistSelection(plman.ActivePlaylist, [numbers[0]], true); // Take first one
				}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'Select random # tracks', func: () => {
					const numbers = range(0, plman.PlaylistItemCount(plman.ActivePlaylist), 1).shuffle(); // Get indexes randomly sorted
					const selLength = numbers[0] ? numbers[0] : numbers[1]; // There is only a single zero...
					plman.ClearPlaylistSelection(plman.ActivePlaylist);
					plman.SetPlaylistSelection(plman.ActivePlaylist, numbers.slice(0, selLength), true); // Take n first ones, where n is also the first or second value of indexes array
				}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: (args = {...scriptDefaultArgs}) => {return 'Select random ' + getPropertiesPairs(args.properties[0], args.properties[1](), 0).playlistLength[1] + ' tracks'}, func: (args = {...scriptDefaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					const numbers = range(0, plman.PlaylistItemCount(plman.ActivePlaylist), 1).shuffle(); // Get indexes randomly sorted
					const selLength = args.properties.playlistLength[1];
					plman.ClearPlaylistSelection(plman.ActivePlaylist);
					plman.SetPlaylistSelection(plman.ActivePlaylist, numbers.slice(0, selLength), true); // Take n first ones, where n is also the first or second value of indexes array
				}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Delete selected tracks', func: () => {plman.RemovePlaylistSelection(plman.ActivePlaylist);}, flags: selectedFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'Delete Non selected tracks', func: () => {plman.RemovePlaylistSelection(plman.ActivePlaylist, true);}, flags: playlistCountFlags});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				const subMenuHalf = menu.newMenu('By halves', subMenuName);
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				const subMenuThird = menu.newMenu('By thirds', subMenuName);
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				const subMenuQuarter = menu.newMenu('By quarters', subMenuName);
				const selArgs = [
					{name: 'Select first Half',		menu: subMenuHalf,		args: {start: 0, end: 1/2}},
					{name: 'Select second Half',		menu: subMenuHalf,		args: {start: 1/2, end: 1}},
					{name: 'Select first Quarter',		menu: subMenuQuarter, 	args: {start: 0, end: 1/4}},
					{name: 'Select first Third',		menu: subMenuThird,		args: {start: 0, end: 1/3}},
					{name: 'Select second Third',		menu: subMenuThird, 	args: {start: 1/3, end: 2/3}},
					{name: 'Select third Third',		menu: subMenuThird,  	args: {start: 2/3, end: 1}},
					{name: 'Select second Quarter',	menu: subMenuQuarter,	args: {start: 1/4, end: 1/2}},
					{name: 'Select third Quarter',		menu: subMenuQuarter,	args: {start: 1/2, end: 3/4}},
					{name: 'Select fourth Quarter',	menu: subMenuQuarter,	args: {start: 3/4, end: 1}}
				];
				selArgs.forEach( (selArg) => {
					if (selArg.name === 'sep') {
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					} else {
						let entryText = selArg.name;
						menu.newEntry({menuName: selArg.menu, entryText, func: (args = selArg.args) => {
							const count = plman.PlaylistItemCount(plman.ActivePlaylist);
							const start = count * args.start;
							const end = Math.floor(count * args.end);
							plman.ClearPlaylistSelection(plman.ActivePlaylist);
							plman.SetPlaylistSelection(plman.ActivePlaylist, range(start, end, 1), true);
						}, flags: playlistCountFlags});
					}
				});
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
	} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

// Other tools
{
	const name = 'Other tools';
	if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
		let menuName = menu.newMenu(name);
		{	// Check tags
			const scriptPath = folders.xxx + 'main\\check_library_tags.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Check tags';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\check_library_tags.txt';
					const subMenuName = menu.newMenu(name, menuName);
					// Delete unused properties
					const toDelete = ['bUseDic'];
					let toMerge = {}; // Deep copy
					Object.keys(checkTags_properties).forEach( (key) => {
						if (toDelete.indexOf(key) === -1) {
							toMerge[key] = [...checkTags_properties[key]];
							toMerge[key][0] = '\'Other tools\\Check tags\' ' + toMerge[key][0];
						}
					});
					// And merge
					menu_properties = {...menu_properties, ...toMerge};
					const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}], bUseDic: false};
					// For submenus
					const tagsToCheck = [
						{tag: 'genre'						, dscrpt: 'Genre (+ dictionary)'		, bUseDic: true	}, 
						{tag: 'style'						, dscrpt: 'Style (+ dictionary)'		, bUseDic: true	},
						{tag: 'mood'						, dscrpt: 'Mood (+ dictionary)'			, bUseDic: true	},
						{tag: 'composer'					, dscrpt: 'Composer'					, bUseDic: false},
						{tag: 'title'						, dscrpt: 'Title'						, bUseDic: false},
						'sep'																						 ,
						{tag: 'genre,style'					, dscrpt: 'Genre + Style (+ dictionary)', bUseDic: true	},
						{tag: 'composer,artist,albumartist'	, dscrpt: 'Composer + Artist'			, bUseDic: false},
					];
					// Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Reports tagging errors (on selection):', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuName, entryText: 'Report errors by comparison', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
						checkTags(args);
					}, flags: multipleSelectedFlags});
					menu.newEntry({menuName: subMenuName, entryText: 'Report errors + dictionary', func: (args = {...scriptDefaultArgs, ...defaultArgs,  bUseDic: true}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
						checkTags(args);
					}, flags: multipleSelectedFlags});
					{	// Submenu
						const subMenuSecondName = menu.newMenu('Check only...', subMenuName);
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Limits comparisons to:', func: null, flags: MF_GRAYED});
						menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
						tagsToCheck.forEach( (obj) => {
							if (obj === 'sep') {menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});return;}
							menu.newEntry({menuName: subMenuSecondName, entryText: obj.dscrpt, func: (args = {...scriptDefaultArgs, ...defaultArgs, bUseDic: obj.bUseDic}) => {
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
								args.properties['tagNamesToCheck'][1] = obj.tag;
								checkTags(args);
							}, flags: multipleSelectedFlags});
						});
					}
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuName, entryText: 'Reports all tags. Slow! (on selection):', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuName, entryText: 'Report all tags by comparison', func: (args = {...scriptDefaultArgs, ...defaultArgs, freqThreshold: 1, maxSizePerTag: Infinity}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
						checkTags(args);
					}, flags: multipleSelectedFlags});
					menu.newEntry({menuName: subMenuName, entryText: 'Report all tags + dictionary', func: (args = {...scriptDefaultArgs, ...defaultArgs, freqThreshold: 1, maxSizePerTag: Infinity, bUseDic: true}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
						checkTags(args);
					}, flags: multipleSelectedFlags});
					{	// Submenu
						const subMenuSecondName = menu.newMenu('Report all from...', subMenuName);
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Limits comparisons to:', func: null, flags: MF_GRAYED});
						menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
						tagsToCheck.forEach( (obj) => {
							if (obj === 'sep') {menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});return;}
							menu.newEntry({menuName: subMenuSecondName, entryText: obj.dscrpt, func: (args = {...scriptDefaultArgs, ...defaultArgs, freqThreshold: 1, maxSizePerTag: Infinity, bUseDic: obj.bUseDic}) => {
								args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
								args.properties['tagNamesToCheck'][1] = obj.tag;
								checkTags(args);
							}, flags: multipleSelectedFlags});
						});
					}
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuName, entryText: 'Configure tags to check...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						const input = utils.InputBox(window.ID, 'Tag name(s) to check\nList \'tagName,tagName,...\' separated by \',\' :', scriptName + ': ' + name, args.properties['tagNamesToCheck'][1]);
						if (args.properties['tagNamesToCheck'][1] === input) {return;}
						if (!input.length) {return;}
						args.properties['tagNamesToCheck'][1] = [...new Set(input.split(',').filter(Boolean))].join(','); // filter holes and remove duplicates
						overwriteProperties(args.properties); // Updates panel
					}});
					menu.newEntry({menuName: subMenuName, entryText: 'Configure excluded tag values...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); //Update properties from the panel
						addTagsToExclusionPopup(args);
					}});
					{
						const subMenuSecondName = menu.newMenu('Configure dictionary...', subMenuName);
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Configure excluded tags for dictionary...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							const input = utils.InputBox(window.ID, 'Tag name(s) to not check against dictionary\nList \'tagName,tagName,...\' separated by \',\' :', scriptName + ': ' + name, args.properties['tagNamesExcludedDic'][1]);
							if (args.properties['tagNamesExcludedDic'][1] === input) {return;}
							if (!input.length) {return;}
							args.properties['tagNamesExcludedDic'][1] = [...new Set(input.split(';').filter(Boolean))].join(';'); // filter holes and remove duplicates
							overwriteProperties(args.properties); // Updates panel
						}});
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Set dictionary...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							const input = utils.InputBox(window.ID, 'Dictionary name:\n(available: de_DE, en_GB, en_US, fr_FR)\n', scriptName + ': ' + name, args.properties['dictName'][1]);
							if (args.properties['dictName'][1] === input) {return;}
							if (!input.length) {return;}
							const dictPath = args.properties['dictPath'][1] + '\\' + input;
							if (isCompatible('1.4.0') ? !utils.IsDirectory(dictPath) : !utils.FileTest(dictPath, 'd')) {fb.ShowPopupMessage('Folder does not exist:\n' + dictPath, scriptName); return;}
							args.properties['dictName'][1] = input;
							overwriteProperties(args.properties); // Updates panel
						}});
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Sets dictionaries folder...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							let input = utils.InputBox(window.ID, 'Path to all dictionaries subfolders:\n(set to empty to restore default path)', scriptName + ': ' + name, args.properties['dictPath'][1]);
							if (args.properties['dictPath'][1] === input) {return;}
							if (!input.length) {input = args.properties['dictPath'][3];}
							if (isCompatible('1.4.0') ? !utils.IsDirectory(input) : !utils.FileTest(input, 'd')) {fb.ShowPopupMessage('Folder does not exist:\n' + input, scriptName); return;}
							args.properties['dictPath'][1] = input;
							overwriteProperties(args.properties); // Updates panel
						}});
					}
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Automate tags
			const scriptPath = folders.xxx + 'main\\tags_automation.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Write tags';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					const subMenuName = menu.newMenu(name, menuName);
					menu.newEntry({menuName: subMenuName, entryText: () => {return getTagsAutomationDescription() + ':'}, func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuName, entryText: 'Add tags on batch to selected tracks', func: tagsAutomation, flags: focusFlags});
					menu.newEntry({menuName, entryText: 'sep'});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Playlist revive
			const scriptPath = folders.xxx + 'main\\playlist_revive.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Playlist Revive';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\playlist_revive.txt';
					{	// Submenu
						const subMenuName = menu.newMenu(name, menuName);
						// Create new properties with previous args
						menu_properties['simThreshold'] = ['\'Other tools\\Playlist Revive\' similarity', 0.50];
						// Checks
						menu_properties['simThreshold'].push({range: [[0,1]], func: !Number.isNaN}, menu_properties['simThreshold'][1]);
						// Merge
						const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
						// Menus
						let entryTextFunc = (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							return args.properties['simThreshold'][1];
						};
						menu.newEntry({menuName: subMenuName, entryText: 'Replaces dead items with ones in library:', func: null, flags: MF_GRAYED});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText: 'Find dead items in all playlists', func: findDeadItems});
						menu.newEntry({menuName: subMenuName, entryText: 'Replace dead items in all playlists', func: playlistReviveAll});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText:'Replace dead items on selection', func:(args = {...scriptDefaultArgs, ...defaultArgs}) => {
							playlistRevive({selItems: plman.GetPlaylistSelectedItems(plman.ActivePlaylist), simThreshold: 1})
						}, flags: focusFlags});
						menu.newEntry({menuName: subMenuName, entryText:() => {return 'Replace dead items on selection (' + entryTextFunc() * 100 + '% simil.)'}, func:(args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							playlistRevive({selItems: plman.GetPlaylistSelectedItems(plman.ActivePlaylist), simThreshold: args.properties['simThreshold'][1]})
						}, flags: focusFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText:'Replace dead items on current playlist', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						playlistRevive({selItems: plman.GetPlaylistItems(plman.ActivePlaylist), simThreshold: 1})
						}, flags: playlistCountFlags});
						menu.newEntry({menuName: subMenuName, entryText:() => {return 'Replace dead items on current playlist (' + entryTextFunc() * 100 + '% simil.)'}, func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							playlistRevive({selItems: plman.GetPlaylistItems(plman.ActivePlaylist), simThreshold: args.properties['simThreshold'][1]})
						}, flags: playlistCountFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText:'Simulate on selection (see console)', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							playlistRevive({selItems: plman.GetPlaylistSelectedItems(plman.ActivePlaylist), simThreshold: 1, bSimulate: true})
						}, flags: focusFlags});
						menu.newEntry({menuName: subMenuName, entryText:() => {return 'Simulate on selection (' + entryTextFunc() * 100 + '% simil.) (see console)'}, func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							playlistRevive({selItems: plman.GetPlaylistSelectedItems(plman.ActivePlaylist), simThreshold: args.properties['simThreshold'][1], bSimulate: true})
						}, flags: focusFlags});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuName, entryText: 'Sets similarity threshold...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							const input = Number(utils.InputBox(window.ID, 'Float number between 0 and 1:', scriptName + ': ' + name, args.properties['simThreshold'][1]));
							if (args.properties['simThreshold'][1] === input) {return;}
							if (!Number.isFinite(input)) {return;}
							if (input < 0 || input > 1) {return;}
							args.properties['simThreshold'][1] = input;
							overwriteProperties(args.properties); // Updates panel
						}});
					}

				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Import track list
			const scriptPath = folders.xxx + 'main\\import_text_playlist.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Import track list';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\import_text_playlist.txt';
					{	// Submenu
						const subMenuName = menu.newMenu(name, menuName);
						// Create new properties with previous args
						menu_properties['importPlaylistPath'] = ['\'Other tools\\Import track list\' path', (_isFile(fb.FoobarPath + 'portable_mode_enabled') ? '.\\profile\\' : fb.ProfilePath) + folders.dataName + 'track_list_to_import.txt'];
						menu_properties['importPlaylistMask'] = ['\'Other tools\\Import track list\' pattern', JSON.stringify(['. ', '%title%', ' - ', '%artist%'])];
						// Checks
						menu_properties['importPlaylistPath'].push({func: isString, portable: true}, menu_properties['importPlaylistPath'][1]);
						// Merge
						const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
						// Menus
						menu.newEntry({menuName: subMenuName, entryText: 'Find matches on library from a txt file:', func: null, flags: MF_GRAYED});
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
							menu.newEntry({menuName: subMenuName, entryText: 'Import from file \\ url...', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							let path;
							try {path = utils.InputBox(window.ID, 'Enter path to text file with list of tracks:', scriptName + ': ' + name, folders.xxx + 'examples\\track_list_to_import.txt', true);}
							catch (e) {return;}
							if (!_isFile(path) && path.indexOf('http://') === -1 && path.indexOf('https://') === -1) {console.log('File does not exist.'); return ;}
							let formatMask;
							try {formatMask = utils.InputBox(window.ID, 'Enter pattern to retrieve tracks. Mask is saved for future use.\n\nTo discard a section, use \'\' or "".\nTo match a section, put the exact chars to match.\nStrings with \'%\' are considered tags to extract.\n\n[\'. \', \'%title%\', \' - \', \'%artist%\'] matches something like:\n1. Respect - Aretha Franklin', scriptName + ': ' + name, args.properties.importPlaylistMask[1].replace(/"/g,'\''), true).replace(/'/g,'"');}
							catch (e) {return;}
							try {formatMask = JSON.parse(formatMask);}
							catch (e) {console.log('Playlist Tools: Invalid format mask'); return;}
							if (!formatMask) {return;}
							const idx = importTextPlaylist({path, formatMask})
							if (idx !== -1) {plman.ActivePlaylist = idx;}
							args.properties.importPlaylistMask[1] = JSON.stringify(formatMask); // Save last mask used
							overwriteProperties(args.properties); // Updates panel							
						}});
						menu.newEntry({menuName: subMenuName, entryText: 'Import from file (path at properties)', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
							args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
							const path = args.properties.importPlaylistPath[1];
							const formatMask = JSON.parse(args.properties.importPlaylistMask[1]);
							importTextPlaylist({path, formatMask})
						}});
					}
					menu.newEntry({menuName, entryText: 'sep'});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Playlist History
			const scriptPath = folders.xxx + 'helpers\\playlist_history.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'Playlist History';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					const subMenuName = menu.newMenu(name, menuName);
					menu.newEntry({menuName: subMenuName, entryText: 'Switch to previous playlists:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuName, entryText: 'Previous playlist', func: goPrevPls, flags: () => {return (plsHistory.length >= 2 ? MF_STRING : MF_GRAYED);}});
					menu.newCondEntry({entryText: 'Playlist History... (cond)', condFunc: () => {
						const [, ...list] = plsHistory;
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						if (!list.length) {menu.newEntry({menuName: subMenuName, entryText: '-None-', func: null, flags: MF_GRAYED});}
						list.forEach( (pls, idx) => {
							menu.newEntry({menuName: subMenuName, entryText: pls.name, func: () => {
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
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		menu.newEntry({entryText: 'sep'});
	} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

// Pool
{
	const name = 'Pools';
	if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
		include(folders.xxx + 'helpers\\helpers_xxx_playlists.js');
		const plsManHelper = folders.xxx + 'helpers\\playlist_manager_helpers.js';
		let isPlsMan = false;
		if (_isFile(plsManHelper)) {
			include(plsManHelper);
			isPlsMan = true;
		}
		readmes[name] = folders.xxx + 'helpers\\readme\\playlist_tools_menu_pools.txt';
		forcedQueryMenusEnabled[name] = true;
		let menuName = menu.newMenu(name);
		{	// Automate tags
			const staticPools = [
			];
			const plLen = defaultArgs.playlistLength;
			const plLenHalf = Math.ceil(plLen / 2);
			const plLenQuart = Math.ceil(plLen / 4);
			let pools = [
				{name: 'Top tracks mix', pool: {
					fromPls: {_LIBRARY_0: plLenQuart, _LIBRARY_1: plLenQuart, _LIBRARY_2: plLenHalf}, 
					query: {_LIBRARY_0: '%rating% EQUAL 3', _LIBRARY_1: '%rating% EQUAL 4', _LIBRARY_2: '%rating% EQUAL 5'}, 
					pickMethod: {_LIBRARY_0: 'random', _LIBRARY_1: 'random', _LIBRARY_2: 'random'},
					toPls: 'Top tracks mix', 
					sort: '',
					}},
				{name: 'Current genre/style and top tracks', pool: {
					fromPls: {_LIBRARY_0: plLenQuart, _LIBRARY_1: plLenQuart, _LIBRARY_2: plLenHalf}, 
					query: {_LIBRARY_0: 'GENRE IS #GENRE# AND NOT (%rating% EQUAL 2 OR %rating% EQUAL 1)', _LIBRARY_1: 'STYLE IS #STYLE# AND NOT (%rating% EQUAL 2 OR %rating% EQUAL 1)', _LIBRARY_2: '%rating% EQUAL 5'}, 
					pickMethod: {_LIBRARY_0: 'random', _LIBRARY_1: 'random', _LIBRARY_2: 'random'},
					toPls: 'Current genre/style and top tracks', 
					sort: '',
					}},
				{name: 'Current genre/style and instrumentals', pool: {
					fromPls: {_LIBRARY_0: plLenHalf, _LIBRARY_1: plLenQuart, _LIBRARY_2: plLenQuart}, 
					query: {_LIBRARY_0: '((GENRE IS #GENRE#) OR (STYLE IS #STYLE#)) AND NOT (%rating% EQUAL 2 OR %rating% EQUAL 1)', _LIBRARY_1: '((GENRE IS #GENRE#) OR (STYLE IS #STYLE#)) AND %rating% EQUAL 5)', _LIBRARY_2: '((GENRE IS #GENRE#) OR (STYLE IS #STYLE#)) AND GENRE IS Instrumental AND NOT (%rating% EQUAL 2 OR %rating% EQUAL 1)'}, 
					pickMethod: {_LIBRARY_0: 'random', _LIBRARY_1: 'random', _LIBRARY_2: 'random'},
					toPls: 'Current genre/style and instrumentals', 
					sort: '',
					}},
			];
			
			let selArg = {...pools[0]};
			const poolsDefaults = [...pools];
			// Create new properties with previous args
			menu_properties['pools'] = [name + ' entries', JSON.stringify(pools)];
			menu_properties['poolsCustomArg'] = [name + '\\Custom pool args', JSON.stringify(selArg)];
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
			// Functions
			const pickMethods = {
				random: (handleListFrom, num, count) => {
						const numbers = range(0, count - 1, 1).shuffle().slice(0, count > num ? num : count); // n randomly sorted. sort + random, highly biased!!
						const handleListFromClone = handleListFrom.Clone().Convert();
						return new FbMetadbHandleList(numbers.flatMap((i) => {return handleListFromClone.slice(i, i + 1)}));
					},
				start: (handleListFrom, num, count) => {if (count > num) {handleListFrom.RemoveRange(num - 1, count);} return handleListFrom;},
				end: (handleListFrom, num, count) => {if (count > num) {handleListFrom.RemoveRange(0, count - num);} return handleListFrom;},
			};
			const do_pool = (pool, properties) => {
				let handleListTo = new FbMetadbHandleList();
				let bAbort = false;
				Object.keys(pool.fromPls).forEach((plsName) => {
					if (bAbort) {return;}
					let handleListFrom;
					// Select source
					switch (true) {
						case plsName.startsWith('_LIBRARY_'): { // Library Source
							handleListFrom = fb.GetLibraryItems();
							console.log('Playlist tools Pools: source -> Library');
							break;
						}
						case plsName.startsWith('_SEARCHBYGRAPH_'): { // Search by GRAPH
							const nameGraph = 'Search similar by Graph...';
							const nameDynGenre = 'Search similar by DynGenre...';
							const nameWeight = 'Search similar by Weight...';
							const bScriptLoaded = !menusEnabled.hasOwnProperty(nameGraph) || !menusEnabled.hasOwnProperty(nameDynGenre) || !menusEnabled.hasOwnProperty(nameWeight) || !menusEnabled.hasOwnProperty(specialMenu) || menusEnabled[nameGraph] === true || menusEnabled[nameDynGenre] === true || menusEnabled[nameWeight] === true || menusEnabled[specialMenu] === true;
							if (typeof do_searchby_distance !== undefined && bScriptLoaded) {
								// Get arguments
								const recipe = isString(pool.recipe[plsName]) ? _jsonParseFile(folders.xxx + 'presets\\Search by\\recipes\\' + pool.recipe[plsName]) : pool.recipe[plsName];
								// Get reference (instead of selection)
								const theme = recipe.hasOwnProperty('theme') ? '' : pool.theme[plsName];
								// Check
								if (!recipe) {
									console.log('Playlist tools Pools: source recipe not found (' + folders.xxx + 'presets\\Search by\\recipes\\' + pool.recipe[plsName] + ').');
									bAbort = true; 
									return;
								}
								const checks = ['sbd_max_graph_distance'];
								let bDone = true;
								checks.forEach((key) => {
									if (!recipe.hasOwnProperty(key)) {
										console.log('Playlist tools Pools: source recipe is missing ' + key + ' (' + folders.xxx + 'main\\search_bydistance.js' + ')');
										bDone = false;
									}
								});
								if (!bDone) {bAbort = true; return;}
								// Force arguments
								recipe.bCreatePlaylist = false; 
								recipe.playlistLength = Infinity; // use all possible tracks
								recipe.method = 'GRAPH';
								recipe.bShowFinalSelection = false;
								recipe.bBasicLogging = false;
								// Apply
								const [selectedHandlesArray, ...rest] = do_searchby_distance({properties, theme, recipe});
								handleListFrom = new FbMetadbHandleList(selectedHandlesArray);
								console.log('Playlist tools Pools: source -> Search by GRAPH');
							} else {
								console.log('Playlist tools Pools: source requires a script not lodaded or disabled (' + folders.xxx + 'main\\search_bydistance.js' + ')');
								bAbort = true;
								return;
							}
							break;
						}
						case plsName.startsWith('_SEARCHBYWEIGHT_'): { // Search by WEIGHT
							if (typeof do_searchby_distance !== undefined) {
								// Get arguments
								const recipe = isString(pool.recipe[plsName]) ? _jsonParseFile(folders.xxx + 'presets\\Search by\\recipes\\' + pool.recipe[plsName]) : pool.recipe[plsName];
								// Get reference (instead of selection)
								const theme = recipe.hasOwnProperty('theme') ? '' : pool.theme[plsName];
								// Check
								if (!recipe) {
									console.log('Playlist tools Pools: source recipe not found (' + folders.xxx + 'presets\\Search by\\recipes\\' + pool.recipe[plsName] + ').');
									bAbort = true; 
									return;
								}
								const checks = [];
								let bDone = true;
								checks.forEach((key) => {
									if (!recipe.hasOwnProperty(key)) {
										console.log('Playlist tools Pools: source recipe is missing ' + key + ' (' + folders.xxx + 'main\\search_bydistance.js' + ')');
										bDone = false;
									}
								});
								if (!bDone) {bAbort = true; return;}
								// Force arguments
								recipe.bCreatePlaylist = false; 
								recipe.playlistLength = Infinity; // use all possible tracks
								recipe.method = 'WEIGHT';
								recipe.bShowFinalSelection = false;
								recipe.bBasicLogging = false;
								// Apply
								const [selectedHandlesArray, ...rest] = do_searchby_distance({properties, theme, recipe});
								handleListFrom = new FbMetadbHandleList(selectedHandlesArray);
								console.log('Playlist tools Pools: source -> Search by WEIGHT');
							} else {
								console.log('Playlist tools Pools: source requires a script not lodaded or disabled (' + folders.xxx + 'main\\search_bydistance.js' + ')');
								bAbort = true;
								return;
							}
							break;
						}
						case plsName.startsWith('_SEARCHBYDYNGENRE_'): { // Search by DYNGENRE
							if (typeof do_searchby_distance !== undefined) {
								// Get arguments
								const recipe = isString(pool.recipe[plsName]) ? _jsonParseFile(folders.xxx + 'presets\\Search by\\recipes\\' + pool.recipe[plsName]) : pool.recipe[plsName];
								// Get reference (instead of selection)
								const theme = recipe.hasOwnProperty('theme') ? '' : pool.theme[plsName];
								// Check
								if (!recipe) {
									console.log('Playlist tools Pools: source recipe not found (' + folders.xxx + 'presets\\Search by\\recipes\\' + pool.recipe[plsName] + ').');
									bAbort = true; 
									return;
								}
								const checks = ['dyngenreWeight'];
								let bDone = true;
								checks.forEach((key) => {
									if (!recipe.hasOwnProperty(key)) {
										console.log('Playlist tools Pools: source recipe is missing ' + key + ' (' + folders.xxx + 'main\\search_bydistance.js' + ')');
										bDone = false;
									}
								});
								if (!bDone) {bAbort = true; return;}
								// Force arguments
								recipe.bCreatePlaylist = false; 
								recipe.playlistLength = Infinity; // use all possible tracks
								recipe.method = 'DYNGENRE';
								recipe.bShowFinalSelection = false;
								recipe.bBasicLogging = false;
								// Apply
								const [selectedHandlesArray, ...rest] = do_searchby_distance({properties, theme, recipe});
								handleListFrom = new FbMetadbHandleList(selectedHandlesArray);
								console.log('Playlist tools Pools: source -> Search by DYNGENRE');
							} else {
								console.log('Playlist tools Pools: source requires a script not lodaded or disabled (' + folders.xxx + 'main\\search_bydistance.js' + ')');
								bAbort = true;
								return;
							}
							break;
						}
						default : { // Playlist Source
							const idxFrom = plman.FindPlaylist(plsName);
							// Try loaded playlist first, then matching pls name (within file) and then by filename
							if (idxFrom === -1) { // Playlist file
								let bDone = false;
								let plsMatch = {};
								if (isPlsMan) {
									const propertiesPanel =  getPropertiesPairs((typeof buttons === 'undefined' ? menu_properties : menu_panelProperties), menu_prefix_panel, 0);
									const playlistPath = JSON.parse(propertiesPanel.playlistPath[1]); // This is retrieved everytime the menu is called
									playlistPath.forEach((path) => { // Find first exact match
										if (bDone) {return;}
										const plsArr = loadPlaylistsFromFolder(playlistPath);
										plsArr.forEach((plsObj) => {
											if (bDone) {return;}
											if (plsObj.name === plsName) {
												handleListFrom = getHandlesFromPlaylist(plsObj.path, path, true); // Load found handles, omit the rest instead of nothing
												plsMatch = plsObj;
												bDone = true;
											}
										});
										if (bDone) {return;}
										plsArr.forEach((plsObj) => {
											if (bDone) {return;}
											if (plsObj.path.replace(path,'').startsWith(plsName)) {
												handleListFrom = getHandlesFromPlaylist(plsObj.path, path, true); // Load found handles, omit the rest instead of nothing
												plsMatch = plsObj;
												bDone = true;
											}
										});
									});
								}
								if (!bDone) {console.log('Playlist tools Pools: source -> Not found - ' + plsName);}
								else {console.log('Playlist tools Pools: source -> ' + plsName + ' (' + plsMatch.path + ')');}
							} else { // Loaded playlist
								console.log('Playlist tools Pools: source -> ' + plsName);
								handleListFrom = plman.GetPlaylistItems(idxFrom);
							}
						}
					}
					if (!handleListFrom || !handleListFrom.Count) {return;}
					// Filter
					const query = typeof pool.query  !== 'undefined' ? pool.query[plsName] : '';
					if (query.length && query.toUpperCase() !== 'ALL') {
						const processedQuery = queryReplaceWithCurrent(query, fb.GetFocusItem(true));
						if (checkQuery(processedQuery, true)) {
							console.log('Playlist tools Pools: filter -> ' + processedQuery);
							handleListFrom = fb.GetQueryItems(handleListFrom, processedQuery);
						} else {fb.ShowPopupMessage('Query not valid. Check it and add it again:\n' + query + '\n' + processedQuery, scriptName); bAbort = true; return;}
					}
					// Remove duplicates
					handleListFrom = do_remove_duplicatesV2(handleListFrom);
					// Remove tracks on destination list
					handleListTo.Clone().Convert().forEach((handle) => {handleListFrom.Remove(handle)});
					// Pick
					const num = pool.fromPls[plsName] || Infinity;
					const count = handleListFrom.Count;
					if (count !== 1) {
						handleListFrom = pickMethods[pool.pickMethod[plsName]](handleListFrom, num, count);
					}
					console.log('Playlist tools Pools: pool size -> ' + handleListFrom.Count + ' (' + count +') tracks');
					handleListTo.InsertRange(handleListTo.Count, handleListFrom);
				});
				if (bAbort) {fb.ShowPopupMessage('Check console. Pools failed with major errors.', scriptName); return;}
				const idxTo = plman.FindOrCreatePlaylist(pool.toPls, true);
				if (plman.IsPlaylistLocked(true)) {return;}
				plman.UndoBackup(idxTo);
				plman.ClearPlaylist(idxTo);
				plman.InsertPlaylistItems(idxTo, 0, handleListTo, true);
				if (typeof pool.sort !== 'undefined') {
					plman.SortByFormat(idxTo, pool.sort);
				}
				plman.ActivePlaylist = idxTo;
			}
			const inputPool = () => {
				// Sources
				let fromPls;
				try {fromPls = utils.InputBox(window.ID, 'Enter playlist source(s) (pairs):\nNo playlist name equals to _LIBRARY_#.\n(playlist,# tracks;playlist,# tracks)', scriptName + ': ' + name, Object.keys(pools[0].pool.fromPls).reduce((total, key) => {return total + (total.length ? ';' : '') + key + ',' + pools[0].pool.fromPls[key];}, ''), true);}
				catch (e) {return;}
				if (!fromPls.length) {console.log('Input was empty'); return;}
				if (fromPls.indexOf(',') === -1) {console.log('Input was not a pair separated by \',\''); return;}
				fromPls = fromPls.split(';');
				fromPls = fromPls.map((pair, index) => {
					pair = pair.split(',');
					if (!pair[0].length) {pair[0] = '_LIBRARY_' + index}
					pair[1] = Number(pair[1]);
					return pair;
				});
				if (fromPls.some((pair) => {return pair.length % 2 !== 0})) {console.log('Input was not a list of pairs separated \';\''); return;}
				if (fromPls.some((pair) => {return isNaN(pair[1])})) {console.log('# tracks was not a number'); return;}
				fromPls = Object.fromEntries(fromPls);
				// Queries
				let query;
				try {query = utils.InputBox(window.ID, 'Enter queries to filter the sources (pairs):\nEmpty or ALL are equivalent, but empty applies global forced query too if enabled.\n(playlist,query;playlist,query)', scriptName + ': ' + name, Object.keys(fromPls).reduce((total, key) => {return total + (total.length ? ';' : '') + key + ',' + 'ALL';}, ''), true);}
				catch (e) {return;}
				if (!query.length) {console.log('Input was empty'); return;}
				if (query.indexOf(',') === -1) {console.log('Input was not a pair separated by \',\''); return;}
				query = query.split(';');
				query = query.map((pair) => {
					pair = pair.split(',');
					// if (!pair[1].length) {pair[1] = 'ALL'}
					return pair;
				});
				// TODO Check queries
				if (query.some((pair) => {return pair.length % 2 !== 0})) {console.log('Input was not a list of pairs separated \';\''); return;}
				if (query.some((pair) => {return !fromPls.hasOwnProperty(pair[0])})) {console.log('Playlist named did not match with sources'); return;}
				query = Object.fromEntries(query);
				// Picking Method
				let pickMethod;
				const pickMethodsKeys = Object.keys(pickMethods);
				try {pickMethod = utils.InputBox(window.ID, 'How tracks should be picked? (pairs)\nMethods: ' + pickMethodsKeys.join(', ') + '\n(playlist,method;playlist,method)', scriptName + ': ' + name, Object.keys(fromPls).reduce((total, key) => {return total + (total.length ? ';' : '') + key + ',' + pickMethodsKeys[0]}, ''), true);}
				catch (e) {return;}
				if (!pickMethod.length) {console.log('Input was empty'); return;}
				if (pickMethod.indexOf(',') === -1) {console.log('Input was not a pair separated by \',\''); return;}
				pickMethod = pickMethod.split(';');
				pickMethod = pickMethod.map((pair) => {
					pair = pair.split(',');
					pair[1] = pair[1].toLowerCase();
					return pair;
				});
				if (pickMethod.some((pair) => {return pair.length % 2 !== 0})) {console.log('Input was not a list of pairs separated \';\''); return;}
				if (pickMethod.some((pair) => {return pickMethodsKeys.indexOf(pair[1]) === -1})) {console.log('Picking method not recognized'); return;}
				pickMethod = Object.fromEntries(pickMethod);
				// Destination
				let toPls;
				try {toPls = utils.InputBox(window.ID, 'Enter playlist destination:', scriptName + ': ' + name, 'Playlist C', true);}
				catch (e) {return;}
				if (!toPls.length) {console.log('Input was empty'); return;}
				// Sort
				let sort = '';
				try {sort = utils.InputBox(window.ID, 'Enter final sorting:\n(empty to randomize)', scriptName + ': ' + name, '%playlist_index%', true);}
				catch (e) {return;}
				// TODO: Test sorting
				// Object
				return {fromPls, query, toPls, sort, pickMethod};
			}
			// Menus
			menu.newEntry({menuName, entryText: 'Use playlist(s) as pool(s) for final playlist:', func: null, flags: MF_GRAYED});
			menu.newEntry({menuName, entryText: 'sep'});
			// Static menus
			staticPools.forEach( (poolObj) => {
				if (poolObj.name === 'sep') {
					menu.newEntry({menuName, entryText: 'sep'});
				} else {
					let entryText = poolObj.name;
					// Global forced query
					const pool = clone(poolObj.pool);
					if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) { // With forced query enabled
						Object.keys(pool.query).forEach((key) => {
							if (pool.query[key].length && pool.query[key].toUpperCase() !== 'ALL') { // ALL query never uses forced query!
								pool.query[key] = '(' + pool.query[key] + ') AND (' + args.forcedQuery + ')';
							} else if (!pool.query[key].length) { // Empty uses forced query or ALL
								pool.query[key] = args.forcedQuery;
							}
						});
					} else {
						Object.keys(pool.query).forEach((key) => { // Otherwise empty is replaced with ALL
							if (!pool.query[key].length) {
								pool.query[key] = 'ALL';
							}
						});
					}
					menu.newEntry({menuName, entryText, func: () => {do_pool(pool);}});
				}
			});
			menu.newCondEntry({entryText: 'Pools... (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
				// Entry list
				args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
				pools = JSON.parse(args.properties['pools'][1]);
				pools.forEach( (poolObj) => {
					// Add separators
					if (poolObj.hasOwnProperty('name') && poolObj.name === 'sep') {
						menu.newEntry({menuName, entryText: 'sep'});
					} else { 
						// Create names for all entries
						let poolName = poolObj.name;
						poolName = poolName.length > 40 ? poolName.substring(0,40) + ' ...' : poolName;
						// Entries
						// Global forced query
						const pool = clone(poolObj.pool);
						if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) {
							Object.keys(pool.query).forEach((key) => { // With forced query enabled
								if (pool.query[key].length && pool.query[key].toUpperCase() !== 'ALL') { // ALL query never uses forced query!
									pool.query[key] = '(' + pool.query[key] + ') AND (' + args.forcedQuery + ')';
								} else if (!pool.query[key].length) { // Empty uses forced query or ALL
									pool.query[key] = args.forcedQuery;
								}
							});
						} else {
							Object.keys(pool.query).forEach((key) => { // Otherwise empty is replaced with ALL
								if (!pool.query[key].length) {
									pool.query[key] = 'ALL';
								}
							});
						}
						menu.newEntry({menuName, entryText: poolName, func: () => {do_pool(pool, args.properties);}});
					}
				});
				menu.newEntry({menuName, entryText: 'sep'});
				{ // Static menu: user configurable
					menu.newEntry({menuName, entryText: 'Custom pool...', func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
						// On first execution, must update from property
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						args.tfo = selArg.tfo = JSON.parse(args.properties['poolsCustomArg'][1]).tfo;
						// Input
						const input = inputPool();
						if (!input) {return;}
						const pool = clone(input);
						if (forcedQueryMenusEnabled[name] && args.forcedQuery.length) {
							Object.keys(pool.query).forEach((key) => { // With forced query enabled
								if (pool.query[key].length && pool.query[key].toUpperCase() !== 'ALL') { // ALL query never uses forced query!
									pool.query[key] = '(' + pool.query[key] + ') AND (' + args.forcedQuery + ')';
								} else if (!pool.query[key].length) { // Empty uses forced query or ALL
									pool.query[key] = args.forcedQuery;
								}
							});
						} else {
							Object.keys(pool.query).forEach((key) => { // Otherwise empty is replaced with ALL
								if (!pool.query[key].length) {
									pool.query[key] = 'ALL';
								}
							});
						}
						// Execute
						do_pool(pool, args.properties);
						// For internal use original object
						selArg.pool = input;
						args.properties['poolsCustomArg'][1] = JSON.stringify(selArg); // And update property with new value
						overwriteProperties(args.properties); // Updates panel
					}});
					// Menu to configure property
					menu.newEntry({menuName, entryText: 'sep'});
				}
				{	// Add / Remove
					menu.newEntry({menuName, entryText: 'Add new entry to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs, ...selArg}) => {
						// Input all variables
						let input;
						let entryName = '';
						try {entryName = utils.InputBox(window.ID, 'Enter name for menu entry\nWrite \'sep\' to add a line.', scriptName + ': ' + name, '', true);}
						catch (e) {return;}
						if (!entryName.length) {return;}
						if (entryName === 'sep') {input = {name: entryName};} // Add separator
						else { // or new entry
							const pool = inputPool();
							if (!pool) {return;}
							input = {name: entryName, pool}
						}
						// Add entry
						pools.push(input);
						// Save as property
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						args.properties['pools'][1] = JSON.stringify(pools); // And update property with new value
						// Presets
						if (!presets.hasOwnProperty('pools')) {presets.pools = [];}
						presets.pools.push(input);
						args.properties['presets'][1] = JSON.stringify(presets);
						overwriteProperties(args.properties); // Updates panel
					}});
					{
						const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), menuName);
						pools.forEach( (pool, index) => {
							const entryText = (pool.name === 'sep' ? '------(separator)------' : (pool.name.length > 40 ? pool.name.substring(0,40) + ' ...' : pool.name));
							menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
								pools.splice(index, 1);
								args.properties['pools'][1] = JSON.stringify(pools);
								// Presets
								if (presets.hasOwnProperty('pools')) {
									presets.pools.splice(presets.pools.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(pool);}), 1);
									if (!presets.pools.length) {delete presets.pools;}
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
							}});
						});
						if (!pools.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
						menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
							pools = [...poolsDefaults];
							args.properties['pools'][1] = JSON.stringify(pools);
							// Presets
							if (presets.hasOwnProperty('pools')) {
								delete presets.pools;
								args.properties['presets'][1] = JSON.stringify(presets);
							}
							overwriteProperties(args.properties); // Updates panel
						}});
					}
				}
			}});
			menu.newCondEntry({entryText: 'Get playlist manager path (cond)', condFunc: () => {
				window.NotifyOthers('Playlist manager: playlistPath', null); // Ask to share paths
				isPlsMan = _isFile(plsManHelper); // Safety check
			}});
		}
	} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

// Macros
{
	const name = 'Macros';
	if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
		let menuName = menu.newMenu(name);
		const scriptPath = folders.xxx + 'helpers\\playlist_tools_menu_macros.js';
		if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
			include(scriptPath);
			readmes[name] = folders.xxx + 'helpers\\readme\\playlist_tools_menu_macros.txt';
			// Create new properties
			const macrosDefaults = [
				{name: 'Test Tools', entry: [
					'Most played Tracks\\Most played from 2021',
					'Most played Tracks\\Most played from (all years)',
					'Top rated Tracks from...\\Top rated from 2021',
					'Select...\\Select first track',
					'Search same by tags...\\By Moods (=6)',
					'Select...\\Select last track',
					'Dynamic Queries...\\Same title (any artist)',
					'Select...\\Select random track',
					'Search similar by Graph...\Random Styles/Genres mix, same Mood',
					'Select...\\Select random track',
					'Special Playlists...\\Influences from any date',
					'Duplicates and tag filtering\\Remove duplicates by title, artist, date',
					'Harmonic mix\\Harmonic mix from playlist',
					'Select...\\Select All',
					'Advanced sort...\\Incremental genre/styles (DynGenre)',
					'Advanced sort...\\Incremental key (Camelot Wheel)',
					'Scatter by tags\\Scatter acoustic tracks',
					'Playlist Revive\\Find dead items in all playlists',
					'Import track list\\Import from file (path at properties)',
					'Pools\\Top tracks mix',
					'Macr0s\\Report library tags errors',
					'Search by Distance\\Find genres/styles not on Graph',
					'Search by Distance\\Debug Graph (check console)'
				]},
				{name: 'Test Tools (with input)', entry: [
					'Top rated Tracks from...\\From year...',
					'Search same by tags...\\By... (pairs of tags)',
					'Standard Queries...\\By... (query)',
					'Dynamic Queries...\\By... (query)',
					'Duplicates and tag filtering\\Filter playlist by... (tags)',
					'Query filtering\\Filter playlist by... (query)',
					'Select...\\Select All',
					'Sort...\\By... (expression)',
					'Playlist manipulation\\Find or create playlist...',
					'Import track list\\Import from file \\ url...',
					'Pools\\Custom pool...'
				]},
				{name: 'sep'},
				{name: 'Report library tags errors', entry: [
					'Standard Queries...\\Entire library',
					'Select...\\Select All',
					'Check tags\\Report errors by comparison'
				]},
				{name: 'Report all library tags', entry: [
					'Standard Queries...\\Entire library',
					'Select...\\Select All',
					'Check tags\\Report all tags by comparison'
				]}
			]; 
			// {name, entry: []}
			menu_properties['macros'] = ['Saved macros', JSON.stringify(macrosDefaults)];
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
			// Menus
			menu.newEntry({menuName, entryText: 'Save and run multiple menu entries:', func: null, flags: MF_GRAYED});
			menu.newEntry({menuName, entryText: 'sep'});
			menu.newCondEntry({entryText: 'Macros', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
				args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
				let propMacros = JSON.parse(args.properties['macros'][1]);
				if (!macros.length && propMacros.length) {macros = propMacros;} // Restore macros list on first init
				// List
				propMacros.forEach((macro) => {
					if (macro.name === 'sep') { // Create separators
						menu.newEntry({menuName, entryText: 'sep'});
					} else {
						menu.newEntry({menuName, entryText: macro.name, func: () => {
							macro.entry.forEach( (entry, idx, arr) => {
								menu.btn_up(void(0), void(0), void(0), entry); // Don't clear menu on last call
							});
						}});
					}
				});
				if (!propMacros.length) {menu.newEntry({menuName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
				menu.newEntry({menuName, entryText: 'sep'});
				// Save
				menu.newEntry({menuName, entryText: 'Start recording a macro', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					const macro = initMacro(menu);
					if (macro.name === 'sep') { // Just add a separator
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						saveMacro();
						args.properties['macros'][1] = JSON.stringify(macros);
						// Presets
						if (!presets.hasOwnProperty('macros')) {presets.macros = [];}
						presets.macros.push(macro);
						args.properties['presets'][1] = JSON.stringify(presets);
						overwriteProperties(args.properties); // Updates panel
					}
				}});
				menu.newEntry({menuName, entryText: 'Stop recording and Save macro', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					const macro = saveMacro();
					args.properties['macros'][1] = JSON.stringify(macros);
					// Presets
					if (!presets.hasOwnProperty('macros')) {presets.macros = [];}
					presets.macros.push(macro);
					args.properties['presets'][1] = JSON.stringify(presets);
					overwriteProperties(args.properties); // Updates panel
				}});
				// Delete
				{
					const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), menuName);
					propMacros.forEach( (macro, index) => {
						const entryText = (macro.name === 'sep' ? '------(separator)------' : (macro.name.length > 40 ? macro.name.substring(0,40) + ' ...' : macro.name));
						menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
							propMacros.splice(index, 1);
							args.properties['macros'][1] = JSON.stringify(propMacros);
							// Presets
							if (presets.hasOwnProperty('macros')) {
								presets.macros.splice(presets.macros.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(macro);}), 1);
								if (!presets.macros.length) {delete presets.macros;}
								args.properties['presets'][1] = JSON.stringify(presets);
							}
							overwriteProperties(args.properties); // Updates panel
							macros = propMacros; // Discards any non saved macro
						}});
					});
					if (!macros.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
					menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
						propMacros = [...macrosDefaults];
						args.properties['macros'][1] = JSON.stringify(propMacros);
						if (presets.hasOwnProperty('macros')) {
							delete presets.macros;
							args.properties['presets'][1] = JSON.stringify(presets);
						}
						overwriteProperties(args.properties); // Updates panel
						macros = []; // Discards any non saved macro
					}});
				}
			}});
		}
		menu.newEntry({entryText: 'sep'});
	} else {menuDisabled.push({menuName: name, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

// Script integration
{
	const name = 'Script integration';
	if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
		let menuName = menu.newMenu(name);
		{	// Main menu editor
			const scriptPath = folders.xxx + 'main\\main_menu_custom.js';
			if (isCompatible('1.4.0') ? utils.IsFile(scriptPath) : utils.FileTest(scriptPath, 'e')){
				const name = 'SMP Main menu';
				if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
					include(scriptPath);
					readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\main_menu_custom.txt';
					const subMenuName = menu.newMenu(name, menuName);
					var mainMenuSMP = Object.values(on_main_menu_entries);
					const mainMenuSMPDefaults = Object.values(on_main_menu_entries);
					menu_properties['mainMenuSMP'] = [menuName + '\\' + name + ' entries', JSON.stringify(mainMenuSMP)]; // On main_menu_custom.js
					const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
					const plsListener = 'pt:listener';
					// Helpers
					function exportMenus(path) {
						const listExport = clone(mainMenuSMP).filter(Boolean).map((_) => {return {name: _.name, funcName: _.funcName, icon: _.hasOwnProperty('icon') ? _.icon : ''};});
						return _save(path + 'smpmenus.json', JSON.stringify(listExport, null, '\t'));
					}
					var exportEntries = function exportEntries(path) {
						const mainMenu = menu.getMainMenuName();
						// Skip menus (!entryText)
						// Separators are not globally filtered to be able to redraw -at least partially- the tree
						// const listExport = menu.getEntries().filter((_) => {return _.hasOwnProperty('entryText') && _.hasOwnProperty('menuName') && !_isFunction(_.entryText);}).map((_) => {return {name: (_.menuName !==  mainMenu ? _.menuName + '\\' + _.entryText : _.entryText)};});
						const tree = {};
						let menuList = [];
						const toSkip = new Set(['Add new entry to list...', 'Remove entry from list...', 'Add new query to list...', 'Remove query from list...', 'From year...', 'By... (pairs of tags)', 'By... (query)', 'Filter playlist by... (query)', 'Configuration', 'Menu 1', 'Menu 2', 'Menu 3', 'Menu 4', 'Menu 5', 'Menu 6', 'Menu 7', 'Menu 8', 'Menu 9', 'Find track(s) in...', 'Check tags', 'Write tags', 'Playlist History', 'Custom pool...', 'Start recording a macro', 'Stop recording and Save macro', 'Playlist Names Commands', 'Include scripts', 'Search by Distance','Global Shortcuts','Set Global Forced Query...', 'Readmes...', 'SMP Main menu', 'Script integration', 'Split playlist list submenus at...', 'Show locked playlist (autoplaylists, etc.)?', 'Show current playlist?', 'Selection manipulation', 'Close playlist...', 'Go to playlist...', 'Send playlist\'s tracks to...', 'Playlist manipulation', 'Remove track(s) from...', 'Find now playing track in...','Other tools', 'Configure dictionary...', 'By halves', 'By quarters', 'By thirds' , 'Send selection to..', 'Don\'t try to find tracks if selecting more than...', 'Filter playlist by... (tags)', 'Set tags (for duplicates)...', 'Set tags (for filtering)...', 'Set number allowed (for filtering)...', 'Sets similarity threshold...', 'From year...', 'From last...']);
						const toSkipStarts = ['(Send sel. to)', 'Remove entry from list...', '(Close) Playlists', '(Go to) Playlists', '(Send all to) Playlists'];
						menu.getEntriesAll().filter((_) => {return _.hasOwnProperty('entryText') && _.hasOwnProperty('menuName');}).forEach((_) => {
							const entryText = _isFunction(_.entryText) ? _.entryText() : _.entryText;
							const menuName = _.menuName;
							// Skip
							if (toSkip.has(entryText) || toSkip.has(menuName)) {return;}
							if (toSkipStarts.some((_) => {return entryText.startsWith(_);}) || toSkipStarts.some((_) => {return menuName.startsWith(_);})) {return;}
							// Save
							if (!tree.hasOwnProperty(menuName)) {tree[menuName] = [];}
							tree[menuName].push({name: (menuName !==  mainMenu ? menuName + '\\' + entryText : entryText)});
							if (!new Set(menuList).has(menuName)) {menuList.push(menuName);};
							if (menuName === mainMenu && entryText === 'sep') {menuList.push({name: entryText});};
						});
						Object.keys(tree).forEach((menuKey) => {
							const idx = menuList.indexOf(menuKey);
							if (idx !== -1) {menuList = [...menuList.slice(0, idx), ...tree[menuKey], ...menuList.slice(idx + 1)];}
						});
						// Filter consecutive separators
						menuList = menuList.filter((item, idx, arr) => {return (item.name !== 'sep' && !item.name.endsWith('\\sep')) || (idx !== 0 && (arr[idx -1].name !== 'sep') && !arr[idx -1].name.endsWith('\\sep'));});
						const listExport = menuList;
						return _save(path + 'playlisttoolsentries.json', JSON.stringify(listExport, null, '\t'));
					}
					// Global scope
					var exportDSP = function exportDSP(path) {
						if (!isCompatible('1.4.0')) {console.log('exportDSP: not compatible with SMP < 1.4'); return false;}
						const listExport = JSON.parse(fb.GetDSPPresets()); // Reformat with tabs
						return _save(path + 'dsp.json', JSON.stringify(listExport, null, '\t'));
					}
					var exportDevices = function exportDevices(path) {
						if (!isCompatible('1.4.0')) {console.log('exportDevices: not compatible with SMP < 1.4'); return false;}
						const listExport = JSON.parse(fb.GetOutputDevices()); // Reformat with tabs
						return _save(path + 'devices.json', JSON.stringify(listExport, null, '\t'));
					}
					var exportComponents = function exportComponents(path) {
						if (!isCompatible('1.4.0')) {console.log('exportComponents: not compatible with SMP < 1.4'); return false;}
						const listExport = {
							foo_run_main: utils.CheckComponent("foo_run_main", true),
							foo_runcmd: utils.CheckComponent("foo_runcmd", true),
							foo_quicksearch: utils.CheckComponent("foo_quicksearch", true),
							foo_youtube: utils.CheckComponent("foo_youtube", true)
						};
						return _save(path + 'components.json', JSON.stringify(listExport, null, '\t'));
					}
					var executeByName = function executeByName(path) {
						const ajQueryFile = fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\toexecute.json';
						const localFile = folders.data + 'toexecute.json';
						const pls = getPlaylistIndexArray(plsListener);
						const plsData = pls.length === 1 && plman.PlaylistItemCount(pls[0]) !== 0 ? plman.GetPlaylistItems(pls[0]).Convert().map((_) => {return {name: _.Path.split('_').pop()};}) : null;
						if (plsData) {plman.RemovePlaylistSwitch(pls[0]);}
						const data = (_isFile(ajQueryFile) ? _jsonParseFile(ajQueryFile) : (_isFile(localFile) ? _jsonParseFile(localFile) : (plsData ? plsData : null)));
						if (data) {
							data.forEach((entry) => {
								const entryName = entry.hasOwnProperty('name') ? entry.name : '';
								if (entryName.length) {
									try {
										menu.btn_up(void(0), void(0), void(0), entryName);
									} catch (e) {console.log('executeByName: Error evaluating: ' + entryName + ' from menu.');}
								} else {console.log('executeByName: Entry has no name property: ' + entry);}
							});
						} else {console.log('executeByName: Error reading source file(s): ' + ajQueryFile);}
					};
					var setDSP = function setDSP(path) {
						if (!isCompatible('1.4.0')) {console.log('setDSP: not compatible with SMP < 1.4'); return;}
						const ajQueryFile = fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\toexecute.json';
						const localFile = folders.data + 'toexecute.json';
						const pls = getPlaylistIndexArray(plsListener);
						const plsData = pls.length === 1 && plman.PlaylistItemCount(pls[0]) === 1 ? plman.GetPlaylistItems(pls[0])[0].Path.split('_').pop() : null;
						if (plsData) {plman.RemovePlaylistSwitch(pls[0]);}
						const data = (_isFile(ajQueryFile) ? _jsonParseFile(ajQueryFile) : (_isFile(localFile) ? _jsonParseFile(localFile) : (plsData ? {name: plsData} : null)));
						if (data) {
							const entryName = data.hasOwnProperty('name') ? data.name : '';
							if (entryName.length) {
								const presets = JSON.parse(fb.GetDSPPresets());
								const idx = presets.findIndex((preset) => {return preset.name === entryName;});
								if (idx !== -1) {fb.SetDSPPreset(idx);}
								else {console.log('setDSP: Error setting dsp: ' + entryName);}
							} else {console.log('setDSP: Entry has no name property: ' + entry);}
						} else {console.log('setDSP: Error reading source file(s): ' + ajQueryFile);}
					};
					var setDevice = function setDevice(path) { 
						if (!isCompatible('1.4.0')) {console.log('setDevice: not compatible with SMP < 1.4'); return;}
						const ajQueryFile = fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\toexecute.json';
						const localFile = folders.data + 'toexecute.json';
						const pls = getPlaylistIndexArray(plsListener);
						const plsData = pls.length === 1 && plman.PlaylistItemCount(pls[0]) === 1 ? plman.GetPlaylistItems(pls[0])[0].Path.split('_').pop() : null;
						if (plsData) {plman.RemovePlaylistSwitch(pls[0]);}
						const data = (_isFile(ajQueryFile) ? _jsonParseFile(ajQueryFile) : (_isFile(localFile) ? _jsonParseFile(localFile) : (plsData ? {name: plsData, device_id: plsData} : null))); 
						if (data) {
							const entryName = data.hasOwnProperty('name') ? data.name : '';
							const entryId = data.hasOwnProperty('name') ? data.device_id : '';
							if (entryName.length) {
								const devices = JSON.parse(fb.GetOutputDevices());
								const idx = devices.findIndex((device) => {return device.name === entryName;});
								if (idx !== -1) {fb.SetOutputDevice(devices[idx].output_id, devices[idx].device_id);}
								else {console.log('setDevice: Error setting device: ' + entryName);}
							} else if (entryId.length) {
								const devices = JSON.parse(fb.GetOutputDevices());
								const idx = devices.findIndex((device) => {return device.device_id === entryId;});
								if (idx !== -1) {fb.SetOutputDevice(devices[idx].output_id, devices[idx].device_id);}
								else {console.log('setDevice: Error setting device: ' + entryId);}
							} else {console.log('setDevice: Entry has no name or device_id property: ' + entry);}
						} else {console.log('setDevice: Error reading source file(s): ' + ajQueryFile);}
					};
					// Start
					deferFunc.push({name, func: (properties) => {
						mainMenuSMP = JSON.parse(properties['mainMenuSMP'][1]);
						mainMenuSMP.forEach((entry, index) => {
							if (entry) {
								on_main_menu_entries[index + 1] = entry;
								if (entry.hasOwnProperty('path') && entry.path.length) {
									try {include(entry.path);}
									catch (e) {console.log(e);}
								}
							}
						});
						if (defaultArgs.bHttpControl() && !exportMenus(defaultArgs.httpControlPath)) {console.log('Error saving SMP main menus for http Control integration.')}
						if (defaultArgs.bHttpControl() && !exportEntries(defaultArgs.httpControlPath)) {console.log('Error saving Playlist Tools entries for http Control integration.')}
						if (defaultArgs.bHttpControl() && !exportDSP(defaultArgs.httpControlPath)) {console.log('Error saving DSP entries for http Control integration.')}
						if (defaultArgs.bHttpControl() && !exportDevices(defaultArgs.httpControlPath)) {console.log('Error saving Devices entries for http Control integration.')}
						if (defaultArgs.bHttpControl() && !exportComponents(defaultArgs.httpControlPath)) {console.log('Error saving Components entries for http Control integration.')}
					}});
					//  Menus
					menu.newEntry({menuName: subMenuName, entryText: 'Config SMP menus:', func: null, flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					menu.newCondEntry({entryText: name + ' (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						// Entry list
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						mainMenuSMP = JSON.parse(args.properties['mainMenuSMP'][1]);
						mainMenuSMP.forEach( (entry, index) => {
							if (!entry) {return;}
							// Add separators
							if (entry.hasOwnProperty('name') && entry.name === 'sep') {
								menu.newEntry({menuName: subMenuName, entryText: 'sep'});
							} else { 
								// Create names for all entries
								let scriptName = entry.name;
								scriptName = scriptName.length > 40 ? scriptName.substring(0,40) + ' ...' : scriptName;
								// Entries
								menu.newEntry({menuName: subMenuName, entryText: scriptName + '\t (' + (index + 1) + ')', func: null, flags: MF_GRAYED});
							}
						});
						if (!mainMenuSMP.filter(Boolean).length) {menu.newEntry({menuName: subMenuName, entryText: '(none set yet)', func: null, flags: MF_GRAYED});}
						menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						{
							const toolName = name;
							const subMenuNameTwo = menu.newMenu('Set menus...', subMenuName);
							const subMenuNameThree = [];
							const options = [
								{name: 'None', func: (idx) => {mainMenuSMP[idx - 1] = null; delete on_main_menu_entries[idx];}},
								{name: 'sep'},
								{name: 'Custom menu', func: (idx) => {
									let funcName = '';
									try {funcName = utils.InputBox(window.ID, 'Enter menu entry:\n(subMenu\\Entry)\nMenu names may be easily retrieved by simulating menu execution with Ctrl + L. Click, which copies entry names to clipboard.', 'Playlist Tools: ' + toolName, '', true);}
									catch (e) {return;}
									if (!funcName.length) {return;}
									let name = '';
									try {name = utils.InputBox(window.ID, 'Enter description (name)', 'Playlist Tools: ' + toolName, funcName, true);}
									catch (e) {return;}
									if (!name.length) {return;}
									let icon = '';
									// Add icons
									if (funcName.startsWith('Most played Tracks') || funcName.startsWith('Top rated Tracks from...')) {icon = 'ui-icon ui-icon-heart';}
									if (funcName.startsWith('Search same by tags...') || funcName.startsWith('Search similar by') || funcName.startsWith('Special Playlists...')) {icon = 'ui-icon ui-icon-link';}
									if (funcName.startsWith('Standard Queries...') || funcName.startsWith('Dynamic Queries...')) {icon = 'ui-icon ui-icon-search';}
									if (funcName.startsWith('Duplicates and tag filtering')) {icon = 'ui-icon ui-icon-trash';}
									if (funcName.startsWith('Query filtering')) {icon = 'ui-icon ui-icon-zoomout';}
									if (funcName.startsWith('Harmonic mix')) {icon = 'ui-icon ui-icon-person';}
									if (funcName.startsWith('Sort...') || funcName.startsWith('Advanced sort...') || funcName.startsWith('Scatter by tags')) {icon = 'ui-icon ui-icon-carat-2-n-s';}
									if (funcName.startsWith('Check tags')) {icon = 'ui-icon ui-icon-print';}
									if (funcName.startsWith('Write tags')) {icon = 'ui-icon ui-icon-pencil';}
									if (funcName.startsWith('Playlist Revive')) {icon = 'ui-icon ui-icon-battery-1';}
									if (funcName.startsWith('Pools')) {icon = 'ui-icon ui-icon-circle-zoomout';}
									if (funcName.startsWith('Macros')) {icon = 'ui-icon ui-icon-clock';}
									// Save
									on_main_menu_entries[idx] = mainMenuSMP[idx - 1] = {name, funcName , menuName: 'menu', icon};
								;}},
								{name: 'Custom function', func: (idx) => {
									let funcName = '';
									try {funcName = utils.InputBox(window.ID, 'Enter function name:\n', 'Playlist Tools: ' + toolName, '', true);}
									catch (e) {return;}
									if (!funcName.length) {return;}
									let path = '';
									try {path = utils.InputBox(window.ID, 'Enter script path', 'Playlist Tools: ' + toolName, funcName, true);}
									catch (e) {return;}
									if (!path.length) {return;}
									let name = '';
									try {name = utils.InputBox(window.ID, 'Enter description (name)', 'Playlist Tools: ' + toolName, funcName, true);}
									catch (e) {return;}
									if (!name.length) {return;}
									on_main_menu_entries[idx] = mainMenuSMP[idx - 1] = {name, funcName , path};
								;}},
								{name: 'sep'},
								{name: 'Add skip Tag at current playback', func: (idx) => {
									fb.ShowPopupMessage('Adds a \'SKIP\' tag using current playback. Meant to be used along Skip Track (foo_skip) component.\nHas an intelligent switch which sets behavior according to playback time:\n	- If time > half track length -> Track will play as usually up to the \'SKIP\' time, where it jumps to next track.\n	- If time < half track length -> Track will play from \'SKIP\' time to the end.\nThis is a workaround for using %playback_time% for tagging, since %playback_time% does not work within masstagger scripts.', scriptName + ': ' + name);
									on_main_menu_entries[idx] = mainMenuSMP[idx - 1] = {name: 'Add skip Tag at current playback', funcName: 'skipTagFromPlayback' , path: folders.xxx + 'main\\skip_tag_from_playback.js', icon: 'ui-icon ui-icon-tag'};
								}},
								{name: 'Execute menu entry by name', func: (idx) => {
									const ajQueryFile = fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\toexecute.json';
									const localFile = folders.data + 'toexecute.json';
									fb.ShowPopupMessage('This entry is meant to be used along online controllers, like ajquery-SMP, to be able to call an arbitrary number of tools by their menu names.\nThe entry name is read from a local json file which should be edited on demand by the server to set the menu entries that must be executed when calling this SMP main menu.\nTracked files can be found at:\n' + ajQueryFile + '\n' + localFile + ' (if previous one is not found)', scriptName + ': ' + name);
									on_main_menu_entries[idx] = mainMenuSMP[idx - 1] = {name: 'Execute menu entry by name', funcName: 'executeByName' , path: '', icon: 'ui-icon ui-icon-star'};
								}},
							];
							// Add this options on > 1.4.0
							if (isCompatible('1.4.0')) {
								options.push(
									{name: 'Set output device', func: (idx) => {
										const ajQueryFile = fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\toexecute.json';
										const localFile = folders.data + 'toexecute.json';
										fb.ShowPopupMessage('This entry is meant to be used along online controllers, like ajquery-SMP, to set ouput device by name.\nThe device name is read from a local json file which should be edited on demand by the server to set the desired device when calling this SMP main menu.\nTracked files can be found at:\n' + ajQueryFile + '\n' + localFile + ' (if previous one is not found)', scriptName + ': ' + name);
										on_main_menu_entries[idx] = mainMenuSMP[idx - 1] = {name: 'Set output device', funcName: 'setDevice' , path: '', icon: 'ui-icon ui-icon-volume-on'};
									}}
								);
								options.push(
									{name: 'Set DSP preset', func: (idx) => {
										const ajQueryFile = fb.ProfilePath + 'foo_httpcontrol_data\\ajquery-xxx\\smp\\toexecute.json';
										const localFile = folders.data + 'toexecute.json';
										fb.ShowPopupMessage('This entry is meant to be used along online controllers, like ajquery-SMP, to set DSP entry by name.\nThe DSP name is read from a local json file which should be edited on demand by the server to set the desired DSP when calling this SMP main menu.\nTracked files can be found at:\n' + ajQueryFile + '\n' + localFile + ' (if previous one is not found)', scriptName + ': ' + name);
										on_main_menu_entries[idx] = mainMenuSMP[idx - 1] = {name: 'Set DSP preset', funcName: 'setDSP' , path: '', icon: 'ui-icon ui-icon-script'};
									}}
								);
							}
							range(1, 9, 1).forEach((idx) => {
								subMenuNameThree.push(menu.newMenu('Menu ' + idx, subMenuNameTwo));
								options.forEach( (entry, index) => {
									const currMenu = subMenuNameThree[idx - 1];
									// Add separators
									if (entry.hasOwnProperty('name') && entry.name === 'sep') {
										menu.newEntry({menuName: currMenu, entryText: 'sep'});
									} else { 
										// Create names for all entries
										let scriptName = entry.name;
										scriptName = scriptName.length > 40 ? scriptName.substring(0,40) + ' ...' : scriptName;
										// Entries
										menu.newEntry({menuName: currMenu, entryText: scriptName, func: () => {
											entry.func(idx);
											args.properties['mainMenuSMP'][1] = JSON.stringify(mainMenuSMP);
											overwriteProperties(args.properties); // Updates panel
											if (!exportMenus(defaultArgs.httpControlPath)) {console.log('Error saving SMP main menus for http Control integration.')}
											if (!exportEntries(defaultArgs.httpControlPath)) {console.log('Error saving Playlist Tools entries for http Control integration.')}
										}});
									}
									menu.newCheckMenu(currMenu, options[0].name, options[options.length - 1].name,  () => {
										const currOption = mainMenuSMP[idx - 1];
										const id = currOption ? options.findIndex((item) => {return item.name === currOption.name}) : 0;
										return (id !== -1 ? (id !== 0 ? id - 2 : 0) : (currOption.hasOwnProperty('menuName') ? 1 : 2)); // Skip sep
									});
								});
							});
						}
						{	// Remove
							const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), subMenuName);
							mainMenuSMP.forEach( (entry, index) => {
								if (!entry) {return;}
								const entryText = (entry.name === 'sep' ? '------(separator)------' : (entry.name.length > 40 ? entry.name.substring(0,40) + ' ...' : entry.name));
								menu.newEntry({menuName: subMenuSecondName, entryText: entryText  + '\t (' + (index + 1) + ')', func: () => {
									mainMenuSMP.splice(index, 1);
									delete on_main_menu_entries[index + 1];
									args.properties['mainMenuSMP'][1] = JSON.stringify(mainMenuSMP);
									// Presets
									if (presets.hasOwnProperty('mainMenuSMP')) {
										presets.mainMenuSMP.splice(presets.mainMenuSMP.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(entry);}), 1);
										if (!presets.mainMenuSMP.length) {delete presets.mainMenuSMP;}
										args.properties['presets'][1] = JSON.stringify(presets);
									}
									overwriteProperties(args.properties); // Updates panel
									if (!exportMenus(defaultArgs.httpControlPath)) {console.log('Error saving SMP main menus for http Control integration.')}
									if (!exportEntries(defaultArgs.httpControlPath)) {console.log('Error saving Playlist Tools entries for http Control integration.')}
								}});
							});
							if (!mainMenuSMP.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
							menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
							menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
								mainMenuSMP = [...mainMenuSMPDefaults];
								args.properties['mainMenuSMP'][1] = JSON.stringify(mainMenuSMP);
								// Presets
								if (presets.hasOwnProperty('mainMenuSMP')) {
									delete presets.mainMenuSMP;
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
								if (!exportMenus(defaultArgs.httpControlPath)) {console.log('Error saving SMP main menus for http Control integration.')}
								if (!exportEntries(defaultArgs.httpControlPath)) {console.log('Error saving Playlist Tools entries for http Control integration.')}
							}});
						}
					}});
				} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
			}
		}
		{	// Playlist Names Commands
			const name = 'Playlist Names Commands';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\playlist_names_commands.txt';
				const subMenuName = menu.newMenu(name, menuName);
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				//  Menus
				menu.newEntry({menuName: subMenuName, entryText: 'Switch event listener:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Enabled Playlist Names Commands', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					if (!args.properties.bPlaylistNameCommands[1]) {
						if ((isCompatible('1.4.0') ? utils.IsFile(readmes[menuName + '\\' + name]) : utils.FileTest(readmes[menuName + '\\' + name], 'e'))) {
							const readme = utils.ReadTextFile(readmes[menuName + '\\' + name], 65001);
							if (readme.length) {
								const answer = WshShell.Popup(readme, 0, scriptName + ': ' + configMenu, popup.question + popup.yes_no);
							if (answer !== popup.yes) {return;}
							}
						}
					}
					args.properties.bPlaylistNameCommands[1] = !args.properties.bPlaylistNameCommands[1];
					overwriteProperties(args.properties); // Updates panel
				}});
				menu.newCheckMenu(subMenuName, 'Enabled Playlist Names Commands', void(0), (args = {...scriptDefaultArgs}) => {return getPropertiesPairs(args.properties[0], args.properties[1](), 0).bPlaylistNameCommands[1];}); 
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Include scripts
			const name = 'Include scripts';
			if (!menusEnabled.hasOwnProperty(name) || menusEnabled[name] === true) {
				readmes[menuName + '\\' + name] = folders.xxx + 'helpers\\readme\\include_scripts.txt';
				const subMenuName = menu.newMenu(name, menuName);
				let scriptIncluded = [];
				let scriptIncludedDefaults = [];
				menu_properties['scriptIncluded'] = [menuName + '\\' + name + ' scripts', JSON.stringify(scriptIncluded)];
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				deferFunc.push({name, func: (properties) => {
					const scriptIncluded = JSON.parse(properties['scriptIncluded'][1]);
					scriptIncluded.forEach((scrObj) => {
						try {include(scrObj.path);}
						catch (e) {return;}
					});
				}});
				//  Menus
				menu.newEntry({menuName: subMenuName, entryText: 'Include headless scripts:', func: null, flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newCondEntry({entryText: name + ' (cond)', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					// Entry list
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					scriptIncluded = JSON.parse(args.properties['scriptIncluded'][1]);
					scriptIncluded.forEach( (scrObj) => {
						// Add separators
						if (scrObj.hasOwnProperty('name') && scrObj.name === 'sep') {
							menu.newEntry({menuName: subMenuName, entryText: 'sep'});
						} else { 
							// Create names for all entries
							let scriptName = scrObj.name;
							scriptName = scriptName.length > 40 ? scriptName.substring(0,40) + ' ...' : scriptName;
							// Entries
							menu.newEntry({menuName: subMenuName, entryText: scriptName, func: null, flags: MF_GRAYED});
						}
					});
					if (!scriptIncluded.length) {menu.newEntry({menuName: subMenuName, entryText: '(none set yet)', func: null, flags: MF_GRAYED});}
					menu.newEntry({menuName: subMenuName, entryText: 'sep'});
					{	// Add / Remove
					menu.newEntry({menuName: subMenuName, entryText: 'Add new entry to list...' , func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						const answer = WshShell.Popup('This is an utility to easily include (\'merge\') multiple SMP scripts into the same panel, thus not wasting multiple panels. Useful for those scripts that don\'t require any UI, user interaction, etc.\n\nNote you must only include simple utility scripts without UI!. Like scripts which set the main menu SPM entries (File\\Spider Monkey Panel) and do nothing more.\n\nThe use of this functionality is done at your own responsibility, it may obviously break things if you use it without thinking.\n\nIn any case, you can later remove the included script at any point or disable the functionality altogether (just disable the associated menu). If the file fails while loading, it will probably crash and will not be added for later startups... so just reload panel and done.', 0, scriptName + ': ' + name, popup.question + popup.yes_no);
						if (answer === popup.no) {return;}
						// Input all variables
						let input;
						let path = '';
						try {path = utils.InputBox(window.ID, 'Enter script path:\nIts use is done at your own responsibility.', scriptName + ': ' + name, '', true);}
						catch (e) {return;}
						if (path === 'sep') {input = {name: path};} // Add separator
						else { // or new entry
							if (_isFile(path)) {
								try {include(path);}
								catch (e) {return;}
								const arr = isCompatible('1.4.0') ? utils.SplitFilePath(path) : utils.FileTest(path, 'split'); //TODO: Deprecated
								const name = (arr[1].endsWith(arr[2])) ? arr[1] : arr[1] + arr[2]; // <1.4.0 Bug: [directory, filename + filename_extension,
								input = {name , path};
							}
						}
						// Add entry
						scriptIncluded.push(input);
						// Save as property
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						args.properties['scriptIncluded'][1] = JSON.stringify(scriptIncluded); // And update property with new value
						// Presets
						if (!presets.hasOwnProperty('scriptIncluded')) {presets.scriptIncluded = [];}
						presets.scriptIncluded.push(input);
						args.properties['presets'][1] = JSON.stringify(presets);
						overwriteProperties(args.properties); // Updates panel
					}});
					{
						const subMenuSecondName = menu.newMenu('Remove entry from list...' + nextId('invisible', true, false), subMenuName);
						scriptIncluded.forEach( (queryObj, index) => {
							const entryText = (queryObj.name === 'sep' ? '------(separator)------' : (queryObj.name.length > 40 ? queryObj.name.substring(0,40) + ' ...' : queryObj.name));
							menu.newEntry({menuName: subMenuSecondName, entryText, func: () => {
								scriptIncluded.splice(index, 1);
								args.properties['scriptIncluded'][1] = JSON.stringify(scriptIncluded);
								// Presets
								if (presets.hasOwnProperty('scriptIncluded')) {
									presets.scriptIncluded.splice(presets.scriptIncluded.findIndex((obj) => {return JSON.stringify(obj) === JSON.stringify(queryObj);}), 1);
									if (!presets.scriptIncluded.length) {delete presets.scriptIncluded;}
									args.properties['presets'][1] = JSON.stringify(presets);
								}
								overwriteProperties(args.properties); // Updates panel
							}});
						});
						if (!scriptIncluded.length) {menu.newEntry({menuName: subMenuSecondName, entryText: '(none saved yet)', func: null, flags: MF_GRAYED});}
						menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
						menu.newEntry({menuName: subMenuSecondName, entryText: 'Restore defaults', func: () => {
							scriptIncluded = [...scriptIncludedDefaults];
							args.properties['scriptIncluded'][1] = JSON.stringify(scriptIncluded);
							// Presets
							if (presets.hasOwnProperty('scriptIncluded')) {
								delete presets.scriptIncluded;
								args.properties['presets'][1] = JSON.stringify(presets);
							}
							overwriteProperties(args.properties); // Updates panel
						}});
					}
				}
				}});
			} else {menuDisabled.push({menuName: name, subMenuFrom: menuName, index: menu.getMenus().length - 1 + disabledCount++});}
		}
	}
}

// Configuration...
{
	if (!menusEnabled.hasOwnProperty(configMenu) || menusEnabled[configMenu] === true) {
		readmes[configMenu + '\\Presets'] = folders.xxx + 'helpers\\readme\\playlist_tools_menu_presets.txt';
		// Create it if it was not already created. Contains entries from multiple scripts
		if (!menu.hasMenu(configMenu)) {
			menu.newMenu(configMenu);
		}
		{	// Menu to configure properties: playlistLength
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
			menu.newEntry({menuName: configMenu, entryText: 'Set Global Playlist Length... ', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
				args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
				const input = Number(utils.InputBox(window.ID, 'Enter desired Playlist Length for playlist creation.\n', scriptName + ': ' + configMenu, args.properties['playlistLength'][1]));
				if (args.properties['playlistLength'][1] === input) {return;}
				if (!Number.isSafeInteger(input)) {return;}
				defaultArgs.playlistLength = input;
				args.properties['playlistLength'][1] = input;
				overwriteProperties(args.properties); // Updates panel
			}});
		}
		{
			const subMenuName = menu.newMenu('Global Forced Query', configMenu);
			{	// Menu to configure properties: forcedQuery
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				menu.newEntry({menuName: subMenuName, entryText: 'Switch forced query functionality:', func: null, flags: MF_GRAYED})
				menu.newEntry({menuName: subMenuName, entryText: 'sep'})
				menu.newCondEntry({entryText: 'forcedQueryMenusEnabled', condFunc: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					forcedQueryMenusEnabled = {...forcedQueryMenusEnabled, ...JSON.parse(args.properties['forcedQueryMenusEnabled'][1])}; // Merge with properties
					overwriteProperties({forcedQueryMenusEnabled: args.properties['forcedQueryMenusEnabled']}); // Updates panel
					Object.keys(forcedQueryMenusEnabled).forEach((key) => {
						menu.newEntry({menuName: subMenuName, entryText: key, func: () => {
							forcedQueryMenusEnabled[key] = !forcedQueryMenusEnabled[key];
							args.properties['forcedQueryMenusEnabled'][1] = JSON.stringify(forcedQueryMenusEnabled);
							overwriteProperties(args.properties); // Updates panel
						}});
						menu.newCheckMenu(subMenuName, key, void(0), () => {return forcedQueryMenusEnabled[key];});
					});
					menu.newEntry({menuName: subMenuName, entryText: 'sep'})
					menu.newEntry({menuName: subMenuName, entryText: 'Set Global Forced Query...', func: () => {
						const input = utils.InputBox(window.ID, 'Enter global query added at playlist creation.\n', scriptName + ': ' + configMenu, args.properties['forcedQuery'][1]);
						if (args.properties['forcedQuery'][1] === input) {return;}
						try {fb.GetQueryItems(new FbMetadbHandleList(), input);} // Sanity check
						catch (e) {fb.ShowPopupMessage('Query not valid. Check it and add it again:\n' + input, scriptName); return;}
						defaultArgs.forcedQuery = input;
						args.properties['forcedQuery'][1] = input;
						overwriteProperties(args.properties); // Updates panel
					}});
				}});
			}
		}
		{
			const subMenuName = menu.newMenu('Tag remapping...', configMenu);
			{	// Menu to configure properties: tags
				const options = ['key', 'styleGenre'];
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				menu.newEntry({menuName: subMenuName, entryText: 'Set the tags used by tools:', func: null, flags: MF_GRAYED})
				menu.newEntry({menuName: subMenuName, entryText: 'sep'})
				options.forEach((tagName) => {
					menu.newEntry({menuName: subMenuName, entryText: capitalize(tagName), func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
						fb.ShowPopupMessage('Note this will NOT work on entries which apply queries like \'Search same by tags...\' since those queries are saved as text.\nIf you want to change tags at those tools, use the apropiate menus to remove/add your own entries.\nAlternatively, you may look at the properties panel to directly edit the menus and tags associated to queries.\n\nIt would not make any sense to remap tags at those places since the tags (and entries) are already configurable...', scriptName + ': ' + configMenu)
						args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
						const key = tagName + 'Tag';
						const input = utils.InputBox(window.ID, 'Enter desired tag name:', scriptName + ': ' + configMenu, args.properties[key][1]);
						if (!input.length) {return;}
						if (args.properties[tagName + 'Tag'][1] === input) {return;}
						defaultArgs[key] = input;
						args.properties[key][1] = input;
						overwriteProperties(args.properties); // Updates panel
					}});
				});
			}
		}
		menu.newEntry({menuName: configMenu, entryText: 'sep'});
		{	// Shortcuts
			const subMenuName = menu.newMenu('Global Shortcuts', configMenu);
			menu.newEntry({menuName: subMenuName, entryText: 'Switch shortcuts functionality:', func: null, flags: MF_GRAYED})
			menu.newEntry({menuName: subMenuName, entryText: 'sep'})
			{	// Enable
				readmes[configMenu + '\\Global Shortcuts'] = folders.xxx + 'helpers\\readme\\global_shortcuts.txt';
				const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
				menu.newEntry({menuName: subMenuName, entryText: 'Enabled Global shortcuts', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
					if (!args.properties.bShortcuts[1]) {
						const answer = WshShell.Popup('Global Shortcuts is an experimental feature bypassing SMP limits.\nReally \'global\', i.e. they work no matter what you are doing in foobar.\nThey stop working when foobar window is minimized... But still work if you \'alt-tab\' between windows, even if foobar is not on screen.\nAs safeguard, key checking is temp. disabled whenever you \'alt-tab\'.\nIt will be re-enabled whenever the playlist tools button is clicked or manually, by pressing \'Ctrl + Shift + E\' at any moment (as a switch).\n\nShortcuts can be configured at:\n' + shortcutsPath + '\n\nAre you sure you want to enable it?', 0, scriptName + ': ' + configMenu, popup.question + popup.yes_no);
						if (answer !== popup.yes) {return;}
					}
					args.properties.bShortcuts[1] = !args.properties.bShortcuts[1];
					overwriteProperties(args.properties); // Updates panel
					// Shortcuts
					if (args.properties.bShortcuts[1]) {
						if (keyCallbacklID === -1) {keyCallbacklID = keyCallbackFn();}
					} else {
						if (keyCallbacklID !== -1) {clearInterval(keyCallbacklID);}
					}
				}});
				menu.newCheckMenu(subMenuName, 'Enabled Global shortcuts', void(0), (args = {...scriptDefaultArgs}) => {return getPropertiesPairs(args.properties[0], args.properties[1](), 0).bShortcuts[1];});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'})
			menu.newEntry({menuName: subMenuName, entryText: 'Open shortcuts file...', func: () => {_explorer(shortcutsPath);}});
		}
		menu.newEntry({menuName: configMenu, entryText: 'sep'});
		{	// Logging
			const subMenuName = menu.newMenu('Logging', configMenu);
			menu.newEntry({menuName: subMenuName, entryText: 'Switch logging functionality:', func: null, flags: MF_GRAYED})
			menu.newEntry({menuName: subMenuName, entryText: 'sep'})
			{	// bDebug
				const scriptDefaultArgs = {properties: [{...menu_panelProperties}, menu_prefix_panel]};
				menu.newEntry({menuName: subMenuName, entryText: 'Enabled extended console debug', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1], 0); // Update properties from the panel
					args.properties.bDebug[1] = !args.properties.bDebug[1];
					defaultArgs.bDebug = args.properties.bDebug[1];
					overwriteProperties(args.properties); // Updates panel
				}});
				menu.newCheckMenu(subMenuName, 'Enabled extended console debug', void(0), (args = {...scriptDefaultArgs}) => {return getPropertiesPairs(args.properties[0], args.properties[1], 0).bDebug[1];});
				// bProfile
				menu.newEntry({menuName: subMenuName, entryText: 'Enabled profiler console log', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1], 0); // Update properties from the panel
					args.properties.bProfile[1] = !args.properties.bProfile[1];
					defaultArgs.bProfile = args.properties.bProfile[1];
					overwriteProperties(args.properties); // Updates panel
				}});
				menu.newCheckMenu(subMenuName, 'Enabled profiler console log', void(0), (args = {...scriptDefaultArgs}) => {return getPropertiesPairs(args.properties[0], args.properties[1], 0).bProfile[1];});
			}
		}
		{	// UI
			const subMenuName = menu.newMenu('UI', configMenu);
			menu.newEntry({menuName: subMenuName, entryText: 'Switch UI functionality:', func: null, flags: MF_GRAYED})
			menu.newEntry({menuName: subMenuName, entryText: 'sep'})
			{	// bTooltipInfo
				const scriptDefaultArgs = {properties: [{...menu_panelProperties}, menu_prefix_panel]};
				menu.newEntry({menuName: subMenuName, entryText: 'Show shortcuts on tooltip', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
					args.properties = getPropertiesPairs(args.properties[0], args.properties[1], 0); // Update properties from the panel
					args.properties.bTooltipInfo[1] = !args.properties.bTooltipInfo[1];
					overwriteProperties(args.properties); // Updates panel
				}});
				menu.newCheckMenu(subMenuName, 'Show shortcuts on tooltip', void(0), (args = {...scriptDefaultArgs}) => {return getPropertiesPairs(args.properties[0], args.properties[1], 0).bTooltipInfo[1];});
			}
		}
		menu.newEntry({menuName: configMenu, entryText: 'sep'});
		{	// Import presets
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
			menu.newEntry({menuName: configMenu, entryText: 'Import user presets... ', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
				args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
				let file;
				try {file = utils.InputBox(window.ID, 'Do you want to import a presets file?\nWill not overwrite current ones.\n(input path to file)', scriptName + ': ' + configMenu, folders.data + 'playlistTools_presets.json', true);}
				catch (e) {return;}
				if (!file.length) {return;}
				if (!_isFile(file)) {fb.ShowPopupMessage('File does not exist: \n' + file, scriptName)}
				const newPresets = _jsonParseFile(file);
				if (!newPresets) {fb.ShowPopupMessage('File not valid: \n' + file, scriptName); return;}
				// Load description
				let readme = '';
				if (newPresets.hasOwnProperty('readme')) {
					readme = newPresets.readme;
					delete newPresets.readme;
				}
				// List entries
				const presetList = Object.keys(newPresets).map((key) => {return '+ ' + key + ' -> ' + args.properties[key][0] + '\n\t- ' + newPresets[key].map((_) => {return _.name + (_.hasOwnProperty('method') ? ' (' + _.method + ')': '');}).join('\n\t- ');});
				readme += (readme.length ? '\n\n' : '') + 'List of presets:\n' + presetList;
				fb.ShowPopupMessage(readme, scriptName + ': Presets (' + file.split('\\').pop() + ')')
				// Accept?
				const answer = WshShell.Popup('Check the popup for description. Do you want to import it?', 0, scriptName + ': Presets (' + file.split('\\').pop() + ')', popup.question + popup.yes_no);
				if (answer === popup.no) {return;}
				// Import
				Object.keys(newPresets).forEach((key) => {
					// Merge with current presets
					let currentMenu = JSON.parse(args.properties[key][1]);
					if (presets.hasOwnProperty(key)) {presets[key] = [...presets[key], ...newPresets[key]];} 
					else {presets[key] = newPresets[key];}
					currentMenu = currentMenu.concat(newPresets[key]);
					args.properties[key][1] = JSON.stringify(currentMenu);
				});
				// Save all
				args.properties['presets'][1] = JSON.stringify(presets);
				overwriteProperties(args.properties); // Updates panel
			}});
		}
		{	// Export all presets
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
			menu.newEntry({menuName: configMenu, entryText: 'Export all user presets... ', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
				args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
				const answer = WshShell.Popup('This will export all user presets (but not the default ones) as a json file, which can be imported later in any Playlist Tools panel.\nThat file can be easily edited with a text editor to add, tune or remove entries. Presets can also be manually deleted in their associated menu.', 0, scriptName + ': ' + configMenu, popup.question + popup.yes_no);
				if (answer === popup.yes) {
					const path = folders.data + 'playlistTools_presets.json'
					_recycleFile(path);
					const readme = 'Backup ' + new Date().toString();
					if (_save(path, JSON.stringify({readme, ...presets}, null, '\t'))) {
						_explorer(path);
						console.log('Playlist tools: presets backup saved at ' + path);
					}
				}
			}});
		}
		menu.newEntry({menuName: configMenu, entryText: 'sep'});
		{	// Reset all config
			const scriptDefaultArgs = {properties: [{...menu_properties}, () => {return menu_prefix;}]};
			menu.newEntry({menuName: configMenu, entryText: 'Reset all configuration... ', func: (args = {...scriptDefaultArgs, ...defaultArgs}) => {
				args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
				const path = folders.data + 'playlistTools_presets.json';
				const answer = WshShell.Popup('Are you sure you want to restore all configuration to default?\nWill delete any related property, user saved menus, etc..', 0, scriptName + ': ' + configMenu, popup.question + popup.yes_no);
				if (answer === popup.yes) {
					const answerPresets = WshShell.Popup('Do you want to maintain your own presets?\n(\'No\' will create a backup file in ' + path + ')', 0, scriptName + ': ' + configMenu, popup.question + popup.yes_no);
					let copy;
					if (answerPresets === popup.yes) {
						copy = {...presets};
					} else {
						_recycleFile(path);
						const readme = 'Backup ' + new Date().toString();
						if (_save(path, JSON.stringify({readme, ...presets}, null, '\t'))) {console.log('Playlist tools: presets backup saved at ' + path);}
						else {console.log('Playlist tools: failed to create backup of presets at ' + path);}
						presets = {};
					}
					// For the current instance
					for (let key in args.properties) {
						args.properties[key][1] = menu_properties[key][1];
					}
					overwriteProperties(args.properties); // Updates panel
					// For the panel (only along buttons)
					if (typeof buttons !== 'undefined' && Object.keys(menu_properties).length) {
						let panelProperties = getPropertiesPairs(menu_panelProperties, menu_prefix_panel, 0);
						for (let key in args.panelProperties) {
							panelProperties[key][1] = menu_panelProperties[key][1];
						}
						overwriteProperties(panelProperties); // Updates panel
					}
					loadProperties(); // Refresh
					// Restore presets
					if (answerPresets === popup.yes) {
						presets = copy;
						Object.keys(presets).forEach((key) => {
							// Add menus
							let currentMenu = JSON.parse(args.properties[key][1]);
							currentMenu = currentMenu.concat(presets[key]);
							args.properties[key][1] = JSON.stringify(currentMenu);
						});
						// Save all
						args.properties['presets'][1] = JSON.stringify(presets);
						overwriteProperties(args.properties); // Updates panel
					}
				}
			}});
		}
		menu.newEntry({menuName: configMenu, entryText: 'sep'});
		{	// Readmes
			const subMenuName = menu.newMenu('Readmes...', configMenu);
			menu.newEntry({menuName: subMenuName, entryText: 'Open popup with readme:', func: null, flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			let iCount = 0;
			if (Object.keys(readmes).length) {
				Object.entries(readmes).forEach(([key, value]) => { // Only show non empty files
					if ((isCompatible('1.4.0') ? utils.IsFile(value) : utils.FileTest(value, 'e'))) { 
						const readme = utils.ReadTextFile(value, 65001); // Executed on script load
						if (readme.length) {
							menu.newEntry({menuName: subMenuName, entryText: key, func: () => { // Executed on menu click
								if ((isCompatible('1.4.0') ? utils.IsFile(value) : utils.FileTest(value, 'e'))) {
									const readme = utils.ReadTextFile(value, 65001);
									if (readme.length) {fb.ShowPopupMessage(readme, key);}
								} else {console.log('Readme not found: ' + value);}
							}});
							iCount++;
						}
					} else {console.log('Readme not found: ' + value);}
				});
			} 
			if (!iCount) {menu.newEntry({menuName: subMenuName, entryText: '- no files - ', func: null, flags: MF_GRAYED});}
		}
	} else {menuDisabled.push({menuName: configMenu, subMenuFrom: menu.getMainMenuName(), index: menu.getMenus().length - 1 + disabledCount++});}
}

/*
	Enable menu
*/
const menuAlt = new _menu();
{
	const menuList = menu.getMenus().slice(1);
	menuDisabled.forEach( (obj) => {menuList.splice(obj.index, 0, obj);});
	const allowed = new Set([menu.getMainMenuName(), 'Playlist manipulation', 'Selection manipulation', 'Other tools', 'Pools', 'Script integration']);
	// Header
	menuAlt.newEntry({entryText: 'Switch menus functionality:', func: null, flags: MF_GRAYED});
	menuAlt.newEntry({entryText: 'sep'});
	// All entries
	menuAlt.newEntry({entryText: 'Restore all', func: () => {
		const panelProperties = getPropertiesPairs(menu_panelProperties, menu_prefix_panel, 0);
		menuList.forEach( (menuEntry) => {
			if (!allowed.has(menuEntry.subMenuFrom)) {return;}
			const menuName = menuEntry.menuName
			menusEnabled[menuName] = true;
		});
		Object.keys(menusEnabled).forEach((key) => {menusEnabled[key] = true;});
		panelProperties['menusEnabled'][1] = JSON.stringify(menusEnabled);
		overwriteProperties(panelProperties); // Updates panel
		window.Reload();
	}});
	menuAlt.newEntry({entryText: 'sep'});
	// Individual entries
	menuList.forEach( (menuEntry) => {
		if (!allowed.has(menuEntry.subMenuFrom)) {return;}
		const menuName = menuEntry.menuName
		const entryName = menuEntry.subMenuFrom === menu.getMainMenuName() ? menuName : '--- ' + menuName;
		if (!menusEnabled.hasOwnProperty(menuName)) {menusEnabled[menuName] = true;}
		menuAlt.newEntry({entryText: entryName, func: () => {
			const panelProperties = getPropertiesPairs(menu_panelProperties, menu_prefix_panel, 0);
			menusEnabled[menuName] = !menusEnabled[menuName];
			panelProperties['menusEnabled'][1] = JSON.stringify(menusEnabled);
			overwriteProperties(panelProperties); // Updates panel
			window.Reload();
		}});
		menuAlt.newCheckMenu(menuAlt.getMainMenuName(), entryName, void(0), () => {return menusEnabled[menuName];});
	});
	menu_panelProperties['menusEnabled'][1] = JSON.stringify(menusEnabled);
}
/* 
	Properties after menu creation
*/ 
loadProperties();

/*
	Helpers
*/
function loadProperties() {
	if (typeof buttons === 'undefined' && Object.keys(menu_properties).length) { // Merge all properties when not loaded along buttons
		// With const var creating new properties is needed, instead of reassigning using A = {...A,...B}
		if (Object.keys(menu_panelProperties).length) {
			Object.entries(menu_panelProperties).forEach(([key, value]) => {menu_properties[key] = value;});
		}
		setProperties(menu_properties, menu_prefix, 0);
		updateMenuProperties(getPropertiesPairs(menu_properties, menu_prefix, 0));
	} else { // With buttons, set these properties only once per panel
		if (Object.keys(menu_panelProperties).length) {
			setProperties(menu_panelProperties, menu_prefix_panel, 0);
		}
	}
}

function updateMenuProperties(propObject, menuFunc = deferFunc) {
	// Sanity checks
	propObject['playlistLength'][1] = Number(propObject['playlistLength'][1]);
	if (!Number.isSafeInteger(propObject['playlistLength'][1]) || propObject['playlistLength'][1] <= 0) {fb.ShowPopupMessage('Playlist length must be a positive integer.\n' + propObject['playlistLength'].slice(0,2), scriptName);}
	try {fb.GetQueryItems(new FbMetadbHandleList(), propObject['forcedQuery'][1]);}
	catch (e) {fb.ShowPopupMessage('Query not valid. Check it and add it again:\n' + propObject['forcedQuery'], scriptName);}
	// Info Popup
	let panelPropObject = (typeof buttons !== 'undefined') ? getPropertiesPairs(menu_panelProperties, menu_prefix_panel, 0) : propObject;
	if (!panelPropObject['firstPopup'][1]) {
		panelPropObject['firstPopup'][1] = true;
		overwriteProperties(panelPropObject); // Updates panel
		const readmeKeys = ['Playlist Tools Menu', 'Macros']; // Must read files on first execution
		readmeKeys.forEach( (key) => {
			const readmePath = readmes[key];
			if ((isCompatible('1.4.0') ? utils.IsFile(readmePath) : utils.FileTest(readmePath, 'e'))) {
				const readme = utils.ReadTextFile(readmePath, 65001);
				if (readme.length) {fb.ShowPopupMessage(readme, key);}
			}
		});
	}
	// And update
	Object.entries(panelPropObject).forEach(([key, value]) => {
		if (defaultArgs.hasOwnProperty(key)) {defaultArgs[key] = value[1];}
	});
	Object.entries(propObject).forEach(([key, value]) => {
		if (defaultArgs.hasOwnProperty(key)) {defaultArgs[key] = value[1];}
		// if (menu_properties.hasOwnProperty(key)) {menu_properties[key] = value;}
		// if (menu_panelProperties.hasOwnProperty(key)) {menu_panelProperties[key] = value;}
			// Specific
		if (key === 'ratingLimits') {defaultArgs[key] = defaultArgs[key].split(',');}
		if (key === 'styleGenreTag') {defaultArgs[key] = JSON.parse(defaultArgs[key]);}
	});
	updateShortcutsNames({sortInputDuplic: propObject.sortInputDuplic[1], sortInputFilter: propObject.sortInputFilter[1], nAllowed: propObject.nAllowed[1]});
	// Presets
	presets = JSON.parse(propObject['presets'][1]);
	// Shortcuts
	if (propObject['bShortcuts'][1]) {
		if (keyCallbacklID === -1) {keyCallbacklID = keyCallbackFn();}
	} else {
		if (keyCallbacklID !== -1) {clearInterval(keyCallbacklID);}
	}
	// Other funcs by menus
	menuFunc.forEach((obj) => {
		if (obj.hasOwnProperty('func') && _isFunction(obj.func)) {
			obj.func(propObject);
		}
	});
}

function updateShortcutsNames(keys = {}) {
	if (_isFile(shortcutsPath)) {
		const data = _jsonParseFile(shortcutsPath);
		if (data) {
			if (Object.keys(keys).length) {
				const sortInputDuplic = keys.hasOwnProperty('sortInputDuplic') ? keys.sortInputDuplic.replace(/,/g, ', ') : null;
				const sortInputFilter = keys.hasOwnProperty('sortInputFilter') ? keys.sortInputFilter.replace(/,/g, ', ') : null;
				const nAllowed = keys.hasOwnProperty('nAllowed') ? '(' + keys.nAllowed + ')' : null;
				for (const key in data) {
					if (data[key].menu === 'Duplicates and tag filtering\\Remove duplicates by ' && sortInputDuplic) {data[key].menu += sortInputDuplic;}
					if (data[key].menu === 'Duplicates and tag filtering\\Filter playlist by ' && sortInputFilter && nAllowed) {data[key].menu += sortInputFilter + ' ' + nAllowed;}
				}
			}
			shortcuts = data;
		}
	} else {
		_save(shortcutsPath, JSON.stringify(shortcuts, null, '\t'))
	}
}

function focusFlags() {return (fb.GetFocusItem(true) ? MF_STRING : MF_GRAYED);}
function playlistCountFlags() {return (plman.PlaylistItemCount(plman.ActivePlaylist) ? MF_STRING : MF_GRAYED);}
function multipleSelectedFlags() {return (plman.GetPlaylistSelectedItems(plman.ActivePlaylist).Count >= 3 ? MF_STRING : MF_GRAYED);}
function selectedFlags() {return (plman.GetPlaylistSelectedItems(plman.ActivePlaylist).Count ? MF_STRING : MF_GRAYED);}

/* 
	Tooltip
*/
// Show tooltip with current track info
function menuTooltip() {
	const selMul = plman.GetPlaylistSelectedItems(plman.ActivePlaylist);
	let infoMul = '';
	if (selMul.Count > 1) {
		infoMul = ' (multiple tracks selected: ' + selMul.Count + ')';
	}
	const sel = fb.GetFocusItem();
	let info = 'No track selected\nSome menus disabled';
	if (sel) {
		let tfo = fb.TitleFormat(
				'Current track:	%artist% / %track% - %title%' +
				'$crlf()Date:		[%date%]' +
				'$crlf()Genres:		[%genre%]' +
				'$crlf()Styles:		[%style%]' +
				'$crlf()Moods:		[%mood%]'
			);
		info = 'Playlist:		' + plman.GetPlaylistName(plman.ActivePlaylist) + infoMul + '\n';
		info += tfo.EvalWithMetadb(sel);
	}
	if (getPropertiesPairs(menu_panelProperties, menu_prefix_panel, 0).bTooltipInfo[1]) {
		info += '\n-----------------------------------------------------'
		info += '\n(L. Click for tools menu)\n(Shift + L. Click to switch enabled menus)\n(Ctrl + L. Click to copy menu names to clipboard)';
	}
	return info;
}

/* 
	Shortcuts
*/
menu.newCondEntry({entryText: 'Shortcuts addition', condFunc: (args = {properties: [{...menu_properties}, () => {return menu_prefix;}]}) => {
	args.properties = getPropertiesPairs(args.properties[0], args.properties[1](), 0); // Update properties from the panel. Note () call on second arg
	if (args.properties.bShortcuts[1]) {
		const entryList = menu.getEntries();
		Object.keys(shortcuts).forEach((key) => {
			const shortcut = shortcuts[key];
			if (!shortcut.hasOwnProperty('keys')) {return;}
			const idx = entryList.findIndex((entry) => {
				if (entry.entryText) {
					if (_isFunction(entry.entryText)) {
						if (entry.entryText().indexOf(shortcut.keys) !== -1) {return false;}
						if (_isFunction(entry.menuName)) {
							return (entry.menuName() + '\\' + entry.entryText()).indexOf(shortcut.menu) !== -1;
						} else {
							return (entry.menuName + '\\' + entry.entryText()).indexOf(shortcut.menu) !== -1;
						}
					} else {
						if (entry.entryText.indexOf(shortcut.keys) !== -1) {return false;}
						if (_isFunction(entry.menuName)) {
							return (entry.menuName() + '\\' + entry.entryText).indexOf(shortcut.menu) !== -1;
						} else {
							return (entry.menuName + '\\' + entry.entryText).indexOf(shortcut.menu) !== -1;
						}
					}
				}
			});
			if (idx !== -1) {
				if (_isFunction(entryList[idx].entryText)) {
					const copyFunc = entryList[idx].entryText;
					entryList[idx].entryText = () => {return copyFunc() + '\t' + shortcut.keys;}
				} else {
					entryList[idx].entryText += '\t' + shortcut.keys;
				}
			}
		});
		menu.entryArr = entryList;
		menu.entryArrTemp = entryList;
	}
}});

// function on_key_up(vkey) {
	// console.log(vkey)
// }

function keyCallback() {
	if (!window.IsVisible) {return;}
	// Enable/Disable switch on Ctrl + Alt + E
	if (!isFinite(keyCallbackDate) && utils.IsKeyPressed(VK_ALT) && utils.IsKeyPressed(VK_CONTROL) && utils.IsKeyPressed(69)) {keyCallbackDate = Date.now(); return;}
	if (isFinite(keyCallbackDate) && utils.IsKeyPressed(VK_ALT) && utils.IsKeyPressed(VK_CONTROL) && utils.IsKeyPressed(69)) {keyCallbackDate = Infinity; return;}
	// Disable on alt-tab
	if (isFinite(keyCallbackDate) && utils.IsKeyPressed(VK_ALT) && utils.IsKeyPressed(VK_TAB)) {keyCallbackDate = Infinity; return;}
	 // Limit rate to 500 ms
	const rate = Date.now() - keyCallbackDate;
	if (rate <= 500 || rate < 0) {return;}
	// Key checking
	const keys = Object.keys(shortcuts);
	const keysLength = keys.length;
	for (let i = 0; i < keysLength; i++) {
		const shortcut = shortcuts[keys[i]];
		if (utils.IsKeyPressed(shortcut.val)) {
			if (shortcut.mod.length && shortcut.mod.some((mod) => {return !utils.IsKeyPressed(mod);})) {continue;}
			keyCallbackDate = Date.now();
			delayFn(() => {
				menu.btn_up(void(0), void(0), void(0), shortcut.menu);
				keyCallbackDate = Date.now();
			},50)();
			break;
		}
	}
}
const keyCallbackFn = repeatFn(keyCallback, 100);
var keyCallbacklID = -1;
var keyCallbackDate = Date.now();