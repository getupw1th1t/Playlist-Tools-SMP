# Changelog

## [Table of Contents]
- [Unreleased](#unreleased)
- [1.0.1](#101---2021-05-02)
- [1.0.0](#100---2021-05-02)

## [Unreleased][]
### Added
- Harmonic mixing: multiple debug additions.
- Search by Distance: New config menu.
- Search by Distance: Entry to compute and show graph on browsers.
- Search by Distance: Entries to descriptors.
- Search by Distance: New tool to find genre or styles not set on the graph (descriptors).
- Search by Distance: New entry to test the Graph on demand for errors.
- Search by Distance: New entry to test the Graph on demand against a set of paths predefined on 'music_graph_test_xxx.js'.
- Search by Distance Cache: is now saved to a json file and reused between different sessions. Cuts loading time by 4 secs for 70K tracks on startup (!).
- Search by Distance Cache: gets automatically refreshed whenever the descriptors crc change. i.e. it will be recalculated with any change by the user too.
- Search by Distance Descriptors: Multiple new additions.
- Portable: Additional checks for portable installations.
### Changed
- Harmonic mixing: small changes and optimizations.
- Harmonic mixing: code for pattern creation moved to camelot_wheel.js.
- Harmonic mixing: code for sending to playlist moved to helpers and reused in multiple scripts.
- Buttons framework: icon bugfix.
- Search by Distance: updated with latest changes.
- Search by Distance Debug: Greatly expanded the debug functions to check possible errors or inconsistencies in the descriptors. It should be foolproof now.
- Search by Distance Descriptors: Multiple fixes on descriptors found with the new debug code.
### Removed
- Removed all lodash dependence and deleted helper.

## [1.0.1] - 2021-05-02
### Added

### Changed
- Hotfix for harmonic mixing. Adds limits to key searching and playlist length.

### Removed

## [1.0.0] - 2021-05-02
### Added
- First release.

### Changed

### Removed

[Unreleased]: https://github.com/regorxxx/Playlist-Tools-SMP/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/regorxxx/Playlist-Tools-SMP/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/regorxxx/Playlist-Tools-SMP/compare/9df4560...v1.0.0
