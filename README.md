# Playlist-Tools-SMP
[![version][version_badge]][changelog]
[![CodeFactor][codefactor_badge]](https://www.codefactor.io/repository/github/regorxxx/Playlist-Tools-SMP/overview/main)
[![CodacyBadge][codacy_badge]](https://www.codacy.com/gh/regorxxx/Playlist-Tools-SMP/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=regorxxx/Playlist-Tools-SMP&amp;utm_campaign=Badge_Grade)
![GitHub](https://img.shields.io/github/license/regorxxx/Playlist-Tools-SMP)  
A collection of [Spider Monkey Panel](https://theqwertiest.github.io/foo_spider_monkey_panel) Scripts for [foobar2000](https://www.foobar2000.org), built within a menu, which serves as a hub for 'usage examples' and shortcuts to the most requested foobar missing functionalities: remove duplicates by tags, revive dead items, check errors on tags, spotify-like playlist creation, advanced queries, etc.

![Animation7](https://user-images.githubusercontent.com/83307074/116756221-471e8500-a9fb-11eb-96c9-2c269bf91fef.gif)

## Features

![Animation9](https://user-images.githubusercontent.com/83307074/116756215-44239480-a9fb-11eb-8489-b56a178c70f4.gif)

It's impossible to offer a complete list of the things that can be done with these tools, in a few words: anything related to playlist creation, sorting, library maintenance, automation, etc. but a readme for every utility can be found using the corresponding menu (on configuration). 

The collection of scripts provided here are not only a direct replacement of [Random Pools](https://www.foobar2000.org/components/view/foo_random_pools) or [MusicIp](https://www.spicefly.com/section.php?section=musicip) but an improvement and generalization in many aspects of those tools.

* **Macros:** allows to record and save the menus entries used, as a macro, to be called later. Automatic custom playlist creation and edits without limits. Works with all tools. (only limitation are popups, which still require user input)
* **Dynamic Queries:** queries which adapt to the currently selected track. i.e. placeholders tags are substituted with the actual values of the currently selected track, then the query is evaluated as usual. Queries created this way are pretty situational, save a lot of writing time and are meant to be used by multiple playlist creation tools.
* **Pools:** playlist creation similar to Random Pools component. Multiple playlists \ library sources (pools) can be set to fill a destination playlist. Configurable selection length per source, query filtering, picking method (random, from start, from end) and final sorting of destination playlist. They may even use dynamic queries changing the way the pools behave according to selection (for ex. a pool which outputs tracks with same key than selected track + another one which outputs same genre tracks), the main limitation of Random Pools component.
* **Fully configurable submenu entries:** shift + left click on menu button allows to switch tools functionality. Individual tools or entire submenus may be disabled/enabled. When all entries from a tool are disabled, the entire script files associated are omitted at loading.
* **User configurable presets:** many tools allow you to add your own presets (for ex. Standard Queries) as menu entries for later use. They may be used along macros to greatly expand their functionality, exported and imported as "addons".
* **Global shortcuts (experimental):** global shortcuts without requiring panel to be in focus assocated to some tools. Shown on the related menu entries tabbed to the right. Experimental feature, read the popup before activating it.
* **Include other scripts (experimental):** easily include ('merge') multiple SMP scripts into the same panel, thus not wasting multiple panels. Useful for those scripts that don't require any UI, user interaction,... like scripts which set the main menu SPM entries (File\\Spider Monkey Panel).
* **Reduce components loaded with better replacements:** one of the main limitations of windows (and thus foobar) is there is a limit of plugins (dlls) that can be associated to a given process(https://hydrogenaud.io/index.php/topic,110142.0.html). Thus, in some installations, specially those using VSTs, when the limit is reached strange things start happening, random crashes, bugs, etc. Something I have experienced myself when running a few VSTs. It's not so hard to reach that limit since many components use multiple dlls! When you count the ones by foobar itself, VSTs, etc. as soon as you configure a bit your installation you come into problems. Therefore Playlist Tools is a solution that can help in that sense, replacing multiple components whose functionality is already included (or improved): Random Pools, Playlist Revive, Best version picker, Database Search, ...

The sky is the limit once you use the current scripts to create your own buttons and tools. Currently contains pre-defined use-cases for these scripts:
* **Most played tracks from...:** from a year or period. (requires [Enhanced Playback Statistics](https://www.foobar2000.org/components/view/foo_enhanced_playcount))  
	.\xxx-scripts\top_tracks.js  
	.\xxx-scripts\top_tracks_from_date.js  
* **Top Rated tracks from...:** from a year or range of years.  
	.\xxx-scripts\top_rated_tracks.js  
* **Search same by tags...:** dynamic queries matching X tags from selection.  
	.\xxx-scripts\search_same_by.js
* **Standard Queries:** like foobar search but allowing presets.  
	.\xxx-scripts\dynamic_query.js
* **Dynamic Queries:** queries with placeholders evaluated with selection.  
	.\xxx-scripts\dynamic_query.js
* **Similar by...:** spotify-like playlist generation. (aka [Search-by-Distance-SMP](https://github.com/regorxxx/Search-by-Distance-SMP))  
	.\xxx-scripts\search_bydistance.js
* **Special Playlists...:** contains functionality from the other scripts  
	.\xxx-scripts\search_bydistance.js  
	.\xxx-scripts\search_same_by.js  
* **Playlist manipulation:** multiple tools for playlist edits.  
	* **Remove duplicates:** using configurable tags.  
		.\xxx-scripts\remove_duplicates.js
	* **Query filtering:** filters current playlist with a query.  
		.\xxx-scripts\filter_by_query.js
	* **Harmonic mix:** Dj-like playlist generation by key. (aka [Camelot-Wheel-Notation](https://github.com/regorxxx/Camelot-Wheel-Notation))  
		.\xxx-scripts\harmonic_mixing.js
	* **Find or create playlist**
	* **Cut playlist length** (for macros) 
	* **Send playlist's tracks to** (for macros) 
	* **Go to playlist** (for macros) 
	* **Close playlist** (for macros) 
* **Selection manipulation:**  
	* **Harmonic mix:** Dj-like selection ordering by key. (aka [Camelot-Wheel-Notation](https://github.com/regorxxx/Camelot-Wheel-Notation))  
		.\xxx-scripts\harmonic_mixing.js
	* **Sort**  
		* Randomize  
		* Reverse  
		* By Mood  
		* By Date  
		* By BPM  
		* **By key:** translates keys (Fm  -> 4A) and sorts them. (aka [Camelot-Wheel-Notation](https://github.com/regorxxx/Camelot-Wheel-Notation))  
			.\xxx-scripts\sort_by_key.js
		* **By Dyngenre:** similar genres/styles are grouped together. (aka [Search-by-Distance-SMP](https://github.com/regorxxx/Search-by-Distance-SMP))  
			.\xxx-scripts\search_bydistance.js
	* **Scatter by tags:** reorders selection to avoid consecutive tracks with the same configurable tag.  
		.\xxx-scripts\scatter_by_tags.js
	* **Find now playling track in...**  
		.\xxx-scripts\find_remove_from_playlists.js
	* **Find track(s) in...**  
		.\xxx-scripts\find_remove_from_playlists.js
	* **Remove track(s) from...**  
		.\xxx-scripts\find_remove_from_playlists.js
	* **Send selection to playlist...** (for macros)  
	* **Select** (for macros)  
		* By halves
		* By thirds
		* By quarters
		* First / Last track
		* Random track / Random # tracks
		* Delete selected / non selected tracks
* **Other tools:**  
	* **Check tags:** checks selection to find errors on tags (useful on entire library).  
		.\xxx-scripts\check_library_tags.js
	* **Write tags:** "macro" to write some tags.  
		.\xxx-scripts\tags_automation.js
	* **Playlist Revive:** replaces and expands playlist revive component.  
		.\xxx-scripts\playlist_revive.js
	* **Playlist History:** history of previously active playlists (for macros).  
		.\xxx-scripts\helpers\playlist_history.js
	* **Include scripts:** add multiple SMP scripts into the same panel.  
* **Pools:** use playlist(s), (dynamic) queries, etc. as source pool(s) for a destination playlist.  
* **Macros:** record and save menus entries used, as a macro, to be called later.  
	.\xxx-scripts\helpers\playlist_tools_menu_macros.js
* **Other scripts integration:**
	* [Playlist-Manager-SMP](https://github.com/regorxxx/Playlist-Manager-SMP): Pools may use tracks from playlists files tracked by the manager, not requiring to have playlists loaded within foobar. i.e. Random Pools component-like playlist creation, using not only queries as sources, but also other playlists or playlists files.

The menus are highly customizable. They are created on demand according to the selected tracks or current playlist, and many entries can be added, removed or edited to suit your needs. Also if some scripts are missing, the menu is rebuilt skipping those entries (letting you to install selectively what you need).

![Animation8](https://user-images.githubusercontent.com/83307074/116756213-4259d100-a9fb-11eb-9452-657389977f69.gif)

![Animation10](https://user-images.githubusercontent.com/83307074/116756219-4685ee80-a9fb-11eb-80be-413f0e691dd4.gif)

### Also integrates
 1. [Search-by-Distance-SMP](https://github.com/regorxxx/Search-by-Distance-SMP): creates intelligent "spotify-like" playlist using high-level data from tracks and computing their similarity using genres/styles.
 2. [Music-Graph](https://github.com/regorxxx/Music-Graph): An open source graph representation of most genres and styles found on popular, classical and folk music.
 3. [Camelot-Wheel-Notation](https://github.com/regorxxx/Camelot-Wheel-Notation): Javascript implementation of the Camelot Wheel, ready to use "harmonic mixing" rules and translations for standard key notations.
 4. [Menu-Framework-SMP](https://github.com/regorxxx/Menu-Framework-SMP): Helper which allows to easily create customizable and dynamic menus.

![playlist_tools_menu_05](https://user-images.githubusercontent.com/83307074/116759000-cebac280-aa00-11eb-8a81-9a450e13205a.gif)

## Installation
See [_TIPS and INSTALLATION (txt)](https://github.com/regorxxx/Playlist-Tools-SMP/blob/main/_TIPS%20and%20INSTALLATION.txt) and the [Wiki](https://github.com/regorxxx/Playlist-Tools-SMP/wiki/Installation).
Not properly following the installation instructions will result in scripts not working as intended. Please don't report errors before checking this.

[changelog]: CHANGELOG.md
[version_badge]: https://img.shields.io/github/release/regorxxx/Playlist-Tools-SMP.svg
[codacy_badge]: https://api.codacy.com/project/badge/Grade/e04be28637dd40d99fae7bd92f740677
[codefactor_badge]: https://www.codefactor.io/repository/github/regorxxx/Playlist-Tools-SMP/badge/main
