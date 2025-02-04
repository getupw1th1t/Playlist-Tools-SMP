﻿'use strict';
//13/05/22

include('helpers_xxx_basic_js.js');
include('helpers_xxx_prototypes.js');
include('helpers_xxx_UI.js');
include('helpers_xxx_flags.js');

/* 
	This is the framework to create buttons as new objects with its own properties and tooltips. They can be merged and loaded multiple times
	as new buttons instances on the same toolbar. Coordinates get updated when loading multiple buttons, removing the need to manually set them.
	Check '_buttons_blank.js' to see the universal buttons structure. It loads on foobar but does nothing, it's just empty.
	Check '_buttons_blank_merged.js' to see the universal structure for merging butons, creating an entire bar
	Check '_buttons_example.js' for a working example of buttons within foobar.
	Check '_buttons_example_merged.js' for a working example of a buttons bar within foobar.
	Check '_buttons_example_merged_double.js' for a working example of merging multiple buttons and bars within foobar.
*/

const buttonsBar = {};
// General config
buttonsBar.config = {
	bShowID: true, // Show Prefixes + ID on tooltips
	toolbarTooltip: '', // Shown on toolbar
	toolbarColor: RGB(211,218,237), // Toolbar color
	bToolbar: false, // Change this on buttons bars files to set the background color
	textColor: RGB(0,0,0),
	activeColor: RGB(0, 163, 240),
	animationColors: [RGBA(10, 120, 204, 50), RGBA(199, 231, 255, 30)],
	orientation: 'x',
	bReflow: false,
	bAlignSize: true,
	partAndStateID: 1, // 1 standard button, 6  bg/border button (+hover)
	scale: _scale(0.7, false)
};
buttonsBar.config.default = Object.fromEntries(Object.entries(buttonsBar.config));
// Drag n drop (internal use)
buttonsBar.move = {bIsMoving: false, btn: null, moveX: null, moveY: null, fromKey: null, toKey: null, rec: {x: null, y: null, w: null, h: null}};
// Button objs
buttonsBar.list = []; // Button properties grouped per script
buttonsBar.listKeys = []; // Button names grouped per script (and found at buttons obj)
buttonsBar.propertiesPrefixes = new Set(); // Global properties names prefixes
buttonsBar.buttons = {}; // Global list
// Others (internal use)
buttonsBar.oldButtonCoordinates = {x: 0, y: 0, w: 0, h: 0}; // To store coordinates of previous buttons when drawing
buttonsBar.tooltipButton = new _tt(null, 'Segoe UI', _scale(10), 600);  // Global tooltip
buttonsBar.gDown = false;
buttonsBar.curBtn = null;

function calcNextButtonCoordinates(coord, buttonOrientation = buttonsBar.config.orientation, recalc = true) {
	let newCoordinates;
	const orientation = buttonOrientation.toLowerCase();
	const old = buttonsBar.oldButtonCoordinates;
	const bFirstButton = !old[orientation] ? true : false;
	const keys = ['x','y','w','h'];
	const bFuncCoord = Object.fromEntries(keys.map((c) => {return [c, isFunction(coord[c])];}));
	const iCoord = Object.fromEntries(keys.map((c) => {return [c, bFuncCoord[c] ? coord[c]() : coord[c]];}));
	newCoordinates = Object.fromEntries(keys.map((c) => {return [c, bFuncCoord[c] ? () => {return old[c] + coord[c]();} : (c !== 'h' && c !== 'w'? old[c] : 0) + iCoord[c]];}));
	if (recalc) {
		if (orientation === 'x') {old.x += iCoord.x + iCoord.w; old.h = Math.max(old.h, iCoord.h);}
		else if (orientation === 'y') {old.y += iCoord.y + iCoord.h; old.w = Math.max(old.w, iCoord.w);}
	}
	if (buttonsBar.config.bReflow && !bFirstButton) {
		if (orientation === 'x' && old.x  > window.Width) {
			newCoordinates.x = coord.x;
			newCoordinates.y = old.y + old.h;
			old.x = iCoord.x + iCoord.w;
			old.y = newCoordinates.y;
		} else if (orientation === 'y' && old.y  > window.Height) {
			newCoordinates.y = coord.y;
			newCoordinates.x = old.x + old.w;
			old.y = iCoord.y + iCoord.h;
			old.x = newCoordinates.x;
		}
	}
	return newCoordinates;
}

function themedButton(coordinates, text, func, state, gFont = _gdiFont('Segoe UI', 12 * buttonsBar.config.scale), description, prefix = '', buttonsProperties = {}, icon = null, gFontIcon = _gdiFont('FontAwesome', 12 * buttonsBar.config.scale)) {
	this.state = state ? state : buttonStates.normal;
	this.animation = []; /* {bActive, condition, animStep} */
	this.active = false;
	this.x = this.currX = coordinates.x * buttonsBar.config.scale;
	this.y = this.currY = coordinates.y * buttonsBar.config.scale;
	this.w = this.currW = coordinates.w * buttonsBar.config.scale;
	this.h = this.currH = coordinates.h * buttonsBar.config.scale;
	this.moveX = null;
	this.moveY = null;
	this.originalWindowWidth = window.Width;
	this.g_theme = window.CreateThemeManager('Button');
	this.gFont = gFont;
	this.gFontIcon = gFontIcon;
	this.description = description;
	this.text = text;
	this.textWidth  = isFunction(this.text) ? (parent) => {return _gr.CalcTextWidth(this.text(parent), gFont);} : _gr.CalcTextWidth(this.text, gFont);
	this.icon = this.gFontIcon.Name !== 'Microsoft Sans Serif' ? icon : null; // if using the default font, then it has probably failed to load the right one, skip icon
	this.iconWidth = isFunction(this.icon) ? (parent) => {return _gr.CalcTextWidth(this.icon(parent), gFontIcon);} : _gr.CalcTextWidth(this.icon, gFontIcon);
	this.func = func;
	this.prefix = prefix; // This let us identify properties later for different instances of the same button, like an unique ID
	this.descriptionWithID = isFunction(this.description) ? (parent) => {return (this.prefix ? this.prefix.replace('_','') + ': ' + this.description(parent) : this.description(parent));} : () => {return (this.prefix ? this.prefix.replace('_','') + ': ' + this.description : this.description);}; // Adds prefix to description, whether it's a func or a string
	this.buttonsProperties = Object.assign({}, buttonsProperties); // Clone properties for later use

	this.containXY = function (x, y) {
		return (this.currX <= x) && (x <= this.currX + this.currW) && (this.currY <= y) && (y <= this.currY + this.currH);
	};

	this.changeState = function (state) {
		let old = this.state;
		this.state = state;
		return old;
	};
	
	this.switchActive = function (bActive = null) {
		this.active = bActive !== null ? bActive : !this.active;
		window.Repaint();
	};
	
	this.switchAnimation = function (name, bActive, condition = null, animationColors = buttonsBar.config.animationColors) {
		const idx = this.animation.findIndex((obj) => {return obj.name === name;});
		if (idx !== -1) { // Deactivated ones must be removed using this.cleanAnimation() afterwards
			this.animation[idx].bActive = bActive;
			this.animation[idx].condition = bActive ? condition : null;
			this.animation[idx].animStep = bActive ? 0 : -1;
			this.animation[idx].date = bActive ? Date.now() : -1;
			this.animation[idx].colors = animationColors;
		} else {
			this.animation.push({name, bActive, condition, animStep: bActive ? 0 : -1, date: bActive ? Date.now() : -1, colors: animationColors});
		}
		throttledRepaint();
	};
	
	this.cleanAnimation = function () {
		if (this.animation.length) {this.animation = this.animation.filter((animation) => {return animation.bActive;});}
	};
	
	this.isAnimationActive = function (name) {
		const idx = this.animation.findIndex((obj) => {return obj.name === name;});
		return idx !== -1 && this.animation[idx].bActive;
	};
	
	this.isAnyAnimationActive = function () {
		return this.animation.some((obj) => {return obj.bActive;});
	};

	this.draw = function (gr, x = this.x, y = this.y, w = this.w, h = this.h) {
		if (this.state === buttonStates.hide) {
			return;
		}
		switch (this.state) {
			case buttonStates.normal: {
				this.g_theme.SetPartAndStateID(buttonsBar.config.partAndStateID, 1);
				break;
			}
			case buttonStates.hover: {
				buttonsBar.tooltipButton.SetValue( (buttonsBar.config.bShowID ? this.descriptionWithID(this) : (isFunction(this.description) ? this.description(this) : this.description) ) , true); // ID or just description, according to string or func.
				this.g_theme.SetPartAndStateID(buttonsBar.config.partAndStateID, 2);
				break;
			}
			case buttonStates.down: {
				this.g_theme.SetPartAndStateID(buttonsBar.config.partAndStateID, 3);
				break;
			}
			case buttonStates.hide: {
				return;
			}
		}
		// New coordinates must be calculated and stored to interact with UI
		let {x: xCalc, y: yCalc, w: wCalc, h: hCalc} = calcNextButtonCoordinates({x, y, w, h});
		this.currX = xCalc; this.currY = yCalc; this.currW = wCalc; this.currH = hCalc;
		// When moving buttons, the button may be drawn at another position though
		if (this.moveX) {xCalc = this.moveX;}
		if (this.moveY) {yCalc = this.moveY;}
		const textCalculated = isFunction(this.text) ? this.text(this) : this.text;
		// Draw button
		this.g_theme.DrawThemeBackground(gr, xCalc, yCalc, wCalc, hCalc);
		// The rest...
		if (this.icon !== null) {
			const iconWidthCalculated = isFunction(this.icon) ? this.iconWidth(this) : this.iconWidth;
			const textWidthCalculated = isFunction(this.text) ? this.textWidth(this) : this.textWidth;
			const iconCalculated = isFunction(this.icon) ? this.icon(this) : this.icon;
			if (iconCalculated) { // Icon
				if (this.active) { // Draw copy of icon in background blurred
					let icon = gdi.CreateImage(this.gFontIcon.Size, this.gFontIcon.Size);
					const g = icon.GetGraphics();
					g.DrawString(iconCalculated, this.gFontIcon, tintColor(buttonsBar.config.activeColor, 50), 0, 0, this.gFontIcon.Size, this.gFontIcon.Size, DT_CENTER | DT_VCENTER | DT_CALCRECT | DT_NOPREFIX);
					icon = icon.Resize(this.gFontIcon.Size + 2, this.gFontIcon.Size + 2, 0);
					icon.ReleaseGraphics(g);
					// Image gets shifted in x and y axis... since it's not using text flags
					gr.DrawImage(icon, xCalc + wCalc / 2 - iconWidthCalculated * 9/10 - textWidthCalculated / 2, yCalc + iconWidthCalculated * 1/3, wCalc, hCalc, 0, 0, wCalc, hCalc, 0);
				}
				gr.GdiDrawText(iconCalculated, this.gFontIcon,  this.active ? buttonsBar.config.activeColor : buttonsBar.config.textColor, xCalc - iconWidthCalculated / 5 - textWidthCalculated / 2, yCalc, wCalc, hCalc, DT_CENTER | DT_VCENTER | DT_CALCRECT | DT_NOPREFIX);
			}
			// Text
			gr.GdiDrawText(textCalculated, this.gFont, buttonsBar.config.textColor, xCalc + iconWidthCalculated, yCalc, wCalc, hCalc, DT_CENTER | DT_VCENTER | DT_CALCRECT | DT_NOPREFIX);
		} else {
			gr.GdiDrawText(textCalculated, this.gFont, buttonsBar.config.textColor, xCalc, yCalc, wCalc, hCalc, DT_CENTER | DT_VCENTER | DT_CALCRECT | DT_NOPREFIX);
		}
		// Process all animations but only paint once
		let bDone = false;
		this.animation.forEach((animation) => {
			if (animation.bActive) {
				if (animation.condition && Object.prototype.toString.call(animation.condition) === '[object Promise]') {animation.condition.then((bEnd) => {if (bEnd) {this.switchAnimation(animation.name, false);}});}
				if (animation.condition && isFunction(animation.condition) && animation.condition()) {this.switchAnimation(animation.name, false);}
				else {
					if (!bDone) {
						bDone = true;
						gr.FillGradRect(xCalc + 1, yCalc + 1, wCalc - 2, hCalc - 2, animation.animStep * 90, animation.colors[0], animation.colors[1], 1);
						const now = Date.now();
						if (now - animation.date > 2000) {
							animation.animStep++;
							animation.date = now;
						}
						
					}
				}
				throttledRepaint();
			}
		});
		this.cleanAnimation(); // Remove finished ones
	};

	this.onClick = function (mask) {
		this.func && this.func(mask);
	};

	this.changeScale = function (scale) {
		const newScale = scale / buttonsBar.config.scale;
		this.w *= newScale;
		this.h *= newScale;
		this.currH *= newScale;
		this.currW *= newScale;
		this.gFont = _gdiFont(this.gFont.Name, 12 * scale);
		this.gFontIcon = _gdiFont(this.gFontIcon.Name, 12 * scale);
		this.textWidth  = isFunction(this.text) ? (parent) => {return _gr.CalcTextWidth(this.text(parent), this.gFont);} : _gr.CalcTextWidth(this.text, this.gFont);
		this.iconWidth = isFunction(this.icon) ? (parent) => {return _gr.CalcTextWidth(this.icon(parent), this.gFontIcon);} : _gr.CalcTextWidth(this.icon, this.gFontIcon);
	};
}
const throttledRepaint = throttle(() => window.Repaint(), 1000);

function drawAllButtons(gr) {
	const orientation = buttonsBar.config.orientation.toLowerCase();
	const bAlignSize = buttonsBar.config.bAlignSize;
	// First calculate the max width or height so all buttons get aligned
	let maxSize = bAlignSize ? getButtonsMaxSize() : -1;
	// Size check
	doOnce('Buttons Size Check', buttonSizeCheck)();
	// Then draw
	for (let key in buttonsBar.buttons) {
		if (Object.prototype.hasOwnProperty.call(buttonsBar.buttons, key)) {
			const button = buttonsBar.buttons[key];
			if (bAlignSize) {button.draw(gr, void(0), void(0), orientation === 'x' ? void(0) : maxSize, orientation === 'x' ? maxSize : void(0));}
			else {button.draw(gr);}
		}
	}
}

function chooseButton(x, y) {
	let i = 0;
	for (let key in buttonsBar.buttons) {
		if (Object.prototype.hasOwnProperty.call(buttonsBar.buttons, key)) {
			if (buttonsBar.buttons[key].containXY(x, y) && buttonsBar.buttons[key].state !== buttonStates.hide) {
				return [buttonsBar.buttons[key], key, i];
			}
		}
		i++;
	}
	return [null, null, null];
}

function on_paint(gr) {
	// Toolbar
	if (buttonsBar.config.bToolbar){
		if (buttonsBar.oldButtonCoordinates.x < window.Width) {gr.FillSolidRect(0, 0, window.Width, window.Height, buttonsBar.config.toolbarColor);} // Toolbar color fix
		else {gr.FillSolidRect(0, 0, window.Width, window.Height, utils.GetSysColour(15));} // Default
	}
	// Buttons
	for (let key in buttonsBar.oldButtonCoordinates) {
		if (!Object.prototype.hasOwnProperty.call(buttonsBar.oldButtonCoordinates, key)) {continue;}
		buttonsBar.oldButtonCoordinates[key] = 0;
	}
	drawAllButtons(gr);
	// Drag n drop buttons
	if (buttonsBar.move.bIsMoving) {
		gr.FillSolidRect(buttonsBar.move.rec.x, buttonsBar.move.rec.y, buttonsBar.move.rec.w, buttonsBar.move.rec.h, opaqueColor(invert(buttonsBar.config.toolbarColor), 15));
		gr.DrawRect(buttonsBar.move.rec.x, buttonsBar.move.rec.y, buttonsBar.move.rec.w, buttonsBar.move.rec.h, 1, invert(buttonsBar.config.toolbarColor));
	}
}

function on_mouse_move(x, y, mask) {
	let old = buttonsBar.curBtn;
	const buttons = buttonsBar.buttons;
	let curBtnKey = '';
	[buttonsBar.curBtn, curBtnKey, ] = chooseButton(x, y);
	
	if (old === buttonsBar.curBtn) {
		if (buttonsBar.gDown) {
			return;
		}
	} else if (buttonsBar.gDown && buttonsBar.curBtn && buttonsBar.curBtn.state !== buttonStates.down) {
		buttonsBar.curBtn.changeState(buttonStates.down);
		old && old.changeState(buttonStates.normal);
		window.Repaint();
		return;
	}
	
	//Tooltip fix
	if (old !== null) {
		// Needed because tooltip is only activated/deactivated on redrawing... otherwise it shows on empty spaces after leaving a button.
		if (buttonsBar.curBtn === null) {buttonsBar.tooltipButton.Deactivate();}
		// This forces redraw even if buttons have the same text! Updates position but tooltip becomes slower since it sets delay time to initial...
		else if (old !== buttonsBar.curBtn && old.description === buttonsBar.curBtn.description) {
			buttonsBar.tooltipButton.Deactivate();
			buttonsBar.tooltipButton.SetDelayTime(3, 0); //TTDT_INITIAL
		} else {buttonsBar.tooltipButton.SetDelayTime(3, buttonsBar.tooltipButton.oldDelay);} 
	}
	// Change button states when not moving them
	old && old.changeState(buttonStates.normal);
	if (!buttonsBar.move.bIsMoving) {
		buttonsBar.curBtn && buttonsBar.curBtn.changeState(buttonStates.hover);
	}
	// Toolbar Tooltip
	if (!buttonsBar.curBtn && buttonsBar.config.toolbarTooltip.length) {
		buttonsBar.tooltipButton.SetValue(buttonsBar.config.toolbarTooltip , true);
	}
	// Move buttons
	if (buttonsBar.curBtn) {
		if (mask === MK_RBUTTON) {
			if (buttonsBar.move.bIsMoving) {
				buttonsBar.move.toKey = curBtnKey;
				if (buttonsBar.move.btn) {
					buttonsBar.move.btn.moveX = x;
					buttonsBar.move.btn.moveY = y;
				}
				const toBtn = buttonsBar.listKeys.find((arr) => {return arr.indexOf(curBtnKey) !== -1;});
				const fKey = toBtn[0];
				const lKey = toBtn[toBtn.length - 1];
				buttonsBar.move.rec.x = buttons[fKey].currX;
				buttonsBar.move.rec.y = buttons[fKey].currY;
				buttonsBar.move.rec.w = fKey !== lKey ? buttons[lKey].currX + buttons[lKey].currW - buttonsBar.move.rec.x : buttons[fKey].currW;
				buttonsBar.move.rec.h = buttons[fKey].currH;
			} else {
				buttonsBar.move.bIsMoving = true;
				buttonsBar.move.btn = buttonsBar.curBtn;
				buttonsBar.move.fromKey = curBtnKey;
				buttonsBar.move.toKey = curBtnKey;
			}
		} else {
			if (buttonsBar.move.bIsMoving) {moveButton(buttonsBar.move.fromKey, buttonsBar.move.toKey);} // Forces window reload on successful move
			buttonsBar.move.bIsMoving = false;
			if (buttonsBar.move.btn) {
				buttonsBar.move.btn.moveX = null;
				buttonsBar.move.btn.moveY = null;
				buttonsBar.move.btn = null;
			}
			buttonsBar.move.fromKey = null;
			buttonsBar.move.toKey = null;
			for (let key in buttonsBar.move.rec) {if (Object.prototype.hasOwnProperty.call(buttonsBar.move.rec, key)) {buttonsBar.move.rec[key] = null;}}
		}
		for (let key in buttons) {
			if (Object.prototype.hasOwnProperty.call(buttons, key)) {
				if (buttons[key] !== buttonsBar.move.btn) {buttons[key].moveX = null; buttons[key].moveY = null;}}
			}
	} else {
		for (let key in buttons) {if (Object.prototype.hasOwnProperty.call(buttons, key)) {buttons[key].moveX = null; buttons[key].moveY = null;}}
		for (let key in buttonsBar.move.rec) {if (Object.prototype.hasOwnProperty.call(buttons, key)) {buttonsBar.move.rec[key] = null;}}
	}
	window.Repaint();
}

function on_mouse_leave() {
	buttonsBar.gDown = false;
	if (buttonsBar.curBtn) {
		buttonsBar.curBtn.changeState(buttonStates.normal);
		window.Repaint();
		buttonsBar.curBtn = null;
	}
}

function on_mouse_lbtn_down(x, y, mask) {
	buttonsBar.gDown = true;
	if (buttonsBar.curBtn) {
		buttonsBar.curBtn.changeState(buttonStates.down);
		window.Repaint();
	}
}

function on_mouse_rbtn_up(x, y, mask) {
	console.log('release');
	// Must return true, if you want to suppress the default context menu.
	// Note: left shift + left windows key will bypass this callback and will open default context menu.
	return buttonsBar.hasOwnProperty('menu') ? buttonsBar.menu().btn_up(x, y) : false;
}

function on_mouse_lbtn_up(x, y, mask) {
	buttonsBar.gDown = false;
	if (buttonsBar.curBtn) {
		buttonsBar.curBtn.onClick(mask);
		// Solves error if you create a new Whsell Popup (curBtn becomes null) after pressing the button and firing curBtn.onClick()
		if (buttonsBar.curBtn && window.IsVisible) {
			buttonsBar.curBtn.changeState(buttonStates.hover);
			window.Repaint();
		}
	} else if (mask === MK_SHIFT) {
		if (buttonsBar.hasOwnProperty('shiftMenu')) {buttonsBar.shiftMenu().btn_up(x, this.y + this.h);}
	}
}

function on_key_down(k) { // Update tooltip with key mask if required
	for (let key in buttonsBar.buttons) {
		if (Object.prototype.hasOwnProperty.call(buttonsBar.buttons, key)) {
			if (buttonsBar.buttons[key].state === buttonStates.hover) {
				const that = buttonsBar.buttons[key];
				buttonsBar.tooltipButton.SetValue( (buttonsBar.config.bShowID ? that.descriptionWithID(that) : (isFunction(that.description) ? that.description(that) : that.description) ) , true); // ID or just description, according to string or func.
			}
		}
	}
}

function on_key_up(k) {
	for (let key in buttonsBar.buttons) {
		if (Object.prototype.hasOwnProperty.call(buttonsBar.buttons, key)) {
			if (buttonsBar.buttons[key].state === buttonStates.hover) {
				const that = buttonsBar.buttons[key];
				buttonsBar.tooltipButton.SetValue( (buttonsBar.config.bShowID ? that.descriptionWithID(that) : (isFunction(that.description) ? that.description(that) : that.description) ) , true); // ID or just description, according to string or func.
			}
		}
	}
}

function getUniquePrefix(string, sep = '_'){
	if (string === null || !string.length) {return '';}
	let newPrefix = string.replace(sep,'') + 0;  // First ID
	let i = 1;
	while (buttonsBar.propertiesPrefixes.has(newPrefix)) { // The rest
		newPrefix = string.replace(sep,'') + i;
		i++;
	}
	buttonsBar.propertiesPrefixes.add(newPrefix);
	newPrefix = newPrefix + sep;
	return newPrefix;
}

function moveButton(fromKey, toKey) {
	if (typeof buttonsPath === 'undefined' || typeof barProperties === 'undefined') {console.log('Buttons: Can not move buttons in current script.'); return;}
	if (fromKey === toKey) {return;}
	const fromPos = buttonsBar.listKeys.findIndex((arr) => {return arr.indexOf(fromKey) !== -1;});
	const toPos = buttonsBar.listKeys.findIndex((arr) => {return arr.indexOf(toKey) !== -1;});
	buttonsPath.splice(toPos, 0, buttonsPath.splice(fromPos, 1)[0]);
	buttonsBar.list.splice(toPos, 0, buttonsBar.list.splice(fromPos, 1)[0]);
	const fileNames = buttonsPath.map((path) => {return path.split('\\').pop();});
	_save(folders.data + barProperties.name[1] + '.json', JSON.stringify(fileNames, null, '\t'));
	// Since properties have a prefix according to their loading order, when there are multiple instances of the same
	// script, moving a button when there are other 'clones' means the other buttons may get their properties names
	// shifted by one. They need to be adjusted or buttons at greater indexes will inherit properties from lower ones!
	const properties = buttonsBar.list[toPos];
	const keys = properties ? Object.keys(properties) : [];
	if (keys.length) {
		const prefix = properties[Object.keys(properties)[0]][0].match(/([A-z]*[0-9]*)(_*[0-9]*\.)/)[1]; // plto3_01. or plt3. -> plto3
		const currentId = prefix.match(/([A-z]*)(?:[0-9]*)/)[1]; // plto
		let currentIdNumber = 0;
		// Backup all properties
		const propertiesBack = buttonsBar.list.map((oldProperties) => {return getPropertiesPairs(oldProperties, '', 0, false);});
		// Just rewrite all Ids with same prefix
		buttonsBar.list.forEach((oldProperties, newIdx) => {
			const oldKeys = oldProperties ? Object.keys(oldProperties) : [];
			if (oldKeys.length) {
				const oldPrefix = oldProperties[oldKeys[0]][0].match(/([A-z]*[0-9]*)(_*[0-9]*\.)/)[1];
				const oldId = oldPrefix.match(/([A-z]*)(?:[0-9]*)/)[1];
				if (oldId === currentId) {
					const backup = propertiesBack[newIdx];
					for (const key in backup) { // Update Id
						if (!backup.hasOwnProperty(key)) {continue;}
						backup[key][0] = backup[key][0].replace(oldPrefix, oldId + currentIdNumber);
					}
					overwriteProperties(backup); // And restore at new position
					currentIdNumber++;
				}
			}
		});
	}
	window.Reload(); // Instead of doing the same with the button objects to update the UI, just reload with new paths... moving buttons is done once anyway
}

function addButton(newButtons) {
	// Check if the button list already has the same button ID
	for (let buttonName in newButtons) {
		if (buttonsBar.buttons.hasOwnProperty(buttonName)) {
			Object.defineProperty(newButtons, buttonName + Object.keys(buttonsBar.buttons).length, Object.getOwnPropertyDescriptor(newButtons, buttonName));
			delete newButtons[buttonName];
		}
	}
	buttonsBar.buttons = {...buttonsBar.buttons, ...newButtons};
}

function buttonSizeCheck () {
	const orientation = buttonsBar.config.orientation;
	const maxSize = getButtonsMaxSize();
	if (buttonsBar.config.scale > 1 && maxSize > -1) {
		if (orientation === 'x' && maxSize > window.Height || orientation === 'y' && maxSize > window.Width) {
			fb.ShowPopupMessage('Buttons ' + (orientation === 'x' ? 'height' : 'width') + ' is greater than current panel size, probably due to a wrong DPI or scale setting.\nIt\'s recommended to reconfigure the buttons scale via menus.', 'Buttons');
		}
	}
}

function getButtonsMaxSize() {
	const orientation = buttonsBar.config.orientation;
	let maxSize = -1;
	for (let key in buttonsBar.buttons) {
		const button = buttonsBar.buttons[key];
		maxSize = (orientation === 'x' ? Math.max(button.currH, maxSize) : Math.max(button.currW, maxSize));
	}
	return maxSize;
}