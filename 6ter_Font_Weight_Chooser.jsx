/*
  6ter_Font_Weight_Chooser.jsx
  Simple After Effects ScriptUI panel to choose font family + weight/style
  and apply to selected text layers.
*/

(function fontWeightChooser(thisObj) {
    var SCRIPT_NAME = "6ter Font Weight Chooser";

    function safeToString(value, fallback) {
        var fb = fallback || "Unknown error.";
        if (value === undefined || value === null) {
            return fb;
        }
        var out = "";
        try {
            out = value.toString ? value.toString() : String(value);
        } catch (e) {
            out = "";
        }
        if (!out || out === "undefined" || out === "null") {
            return fb;
        }
        return out;
    }

    function safeAlert(msg) {
        alert(safeToString(msg, "Unknown error."), SCRIPT_NAME);
    }

    function getActiveComp() {
        var item = app.project ? app.project.activeItem : null;
        if (item && item instanceof CompItem) {
            return item;
        }
        return null;
    }

    function getSelectedTextLayers() {
        var comp = getActiveComp();
        if (!comp) {
            return { ok: false, reason: "Open an active composition first.", layers: [] };
        }

        var selected = comp.selectedLayers;
        var textLayers = [];
        var i;
        for (i = 0; i < selected.length; i++) {
            if (selected[i].property("Source Text") !== null) {
                textLayers.push(selected[i]);
            }
        }

        if (textLayers.length === 0) {
            return { ok: false, reason: "Select at least one text layer.", layers: [] };
        }

        return { ok: true, reason: "", layers: textLayers };
    }

    function normalize(value) {
        return String(value || "").toLowerCase().replace(/[\s_\-]+/g, "");
    }

    function hasToken(haystack, token) {
        return normalize(haystack).indexOf(normalize(token)) !== -1;
    }

    function collectFonts() {
        var out = {
            families: [],
            byFamily: {}
        };

        if (!app.fonts) {
            return out;
        }

        var i, j;

        // AE 24+ preferred source.
        if (app.fonts.allFonts && app.fonts.allFonts.length) {
            for (i = 0; i < app.fonts.allFonts.length; i++) {
                var familyGroup = app.fonts.allFonts[i];
                if (!familyGroup || !familyGroup.length) {
                    continue;
                }

                var familyName = String(familyGroup[0].familyName || familyGroup[0].name || "Unknown");
                if (!out.byFamily[familyName]) {
                    out.byFamily[familyName] = [];
                    out.families.push(familyName);
                }

                for (j = 0; j < familyGroup.length; j++) {
                    var fObj = familyGroup[j];
                    out.byFamily[familyName].push({
                        family: familyName,
                        label: String(fObj.styleName || "Regular"),
                        styleName: String(fObj.styleName || "Regular"),
                        postScriptName: String(fObj.postScriptName || ""),
                        name: String(fObj.name || ""),
                        fontObj: fObj
                    });
                }
            }
        } else if (app.fonts.length) {
            // Backward-compatible source.
            for (i = 0; i < app.fonts.length; i++) {
                var f = app.fonts[i];
                var family = String(f.familyName || f.name || "Unknown");
                if (!out.byFamily[family]) {
                    out.byFamily[family] = [];
                    out.families.push(family);
                }
                out.byFamily[family].push({
                    family: family,
                    label: String(f.styleName || "Regular"),
                    styleName: String(f.styleName || "Regular"),
                    postScriptName: String(f.postScriptName || ""),
                    name: String(f.name || ""),
                    fontObj: f
                });
            }
        }

        out.families.sort();
        for (i = 0; i < out.families.length; i++) {
            var fam = out.families[i];
            out.byFamily[fam].sort(function (a, b) {
                return a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1;
            });
        }

        return out;
    }

    function getExpectedWeightToken(styleLabel) {
        var s = String(styleLabel || "").toLowerCase();
        if (s.indexOf("black") !== -1 || s.indexOf("heavy") !== -1) { return "black"; }
        if (s.indexOf("bold") !== -1 || s.indexOf("demi") !== -1 || s.indexOf("semi") !== -1) { return "bold"; }
        if (s.indexOf("medium") !== -1) { return "medium"; }
        return "regular";
    }

    function styleMatches(textDoc, styleLabel) {
        var token = getExpectedWeightToken(styleLabel);
        var assigned = String(textDoc.fontStyle || "") + " " + String(textDoc.font || "");
        if (token === "regular") {
            return true;
        }
        if (token === "black") {
            return hasToken(assigned, "black") || hasToken(assigned, "heavy");
        }
        return hasToken(assigned, token);
    }

    function tryResolveByFamilyStyle(family, styleLabel) {
        if (!app.fonts || !app.fonts.getFontsByFamilyNameAndStyleName) {
            return null;
        }
        try {
            var arr = app.fonts.getFontsByFamilyNameAndStyleName(family, styleLabel);
            if (arr && arr.length > 0) {
                return arr[0];
            }
        } catch (e) {}
        return null;
    }

    function applyFamilyStyleToLayer(layer, family, styleEntry, allowFauxBold) {
        var sourceText = layer.property("Source Text");
        if (!sourceText) {
            return;
        }

        var textDoc = sourceText.value;
        var targetFontObj = tryResolveByFamilyStyle(family, styleEntry.styleName) || styleEntry.fontObj;
        var assigned = false;

        try {
            if (textDoc.fontObject !== undefined && targetFontObj) {
                textDoc.fontObject = targetFontObj;
                assigned = true;
            }
        } catch (eObj) {
            assigned = false;
        }

        if (!assigned && styleEntry.postScriptName) {
            try {
                textDoc.font = styleEntry.postScriptName;
                assigned = true;
            } catch (ePs) {
                assigned = false;
            }
        }

        if (!assigned && styleEntry.name) {
            try {
                textDoc.font = styleEntry.name;
                assigned = true;
            } catch (eName) {
                assigned = false;
            }
        }

        if (!assigned) {
            throw new Error("Unable to assign the requested font style.");
        }

        // If AE silently falls back to Regular, use fauxBold as final fallback for bold-like styles.
        if (!styleMatches(textDoc, styleEntry.styleName)) {
            var weightToken = getExpectedWeightToken(styleEntry.styleName);
            if (allowFauxBold && (weightToken === "bold" || weightToken === "black") && textDoc.fauxBold !== undefined) {
                try {
                    textDoc.fauxBold = true;
                } catch (eFb) {}
            }
        } else if (textDoc.fauxBold !== undefined) {
            // Keep normal styles clean when real match exists.
            try {
                textDoc.fauxBold = false;
            } catch (eClear) {}
        }

        sourceText.setValue(textDoc);
    }

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.margins = 12;
        pal.spacing = 8;

        var fontsData = collectFonts();

        pal.add("statictext", undefined, "Choose family and weight/style");

        var famGroup = pal.add("group");
        famGroup.orientation = "row";
        famGroup.alignChildren = ["left", "center"];
        famGroup.add("statictext", undefined, "Family:");
        var familyDropdown = famGroup.add("dropdownlist", undefined, fontsData.families);
        familyDropdown.preferredSize.width = 270;

        var styleGroup = pal.add("group");
        styleGroup.orientation = "row";
        styleGroup.alignChildren = ["left", "center"];
        styleGroup.add("statictext", undefined, "Style:");
        var styleDropdown = styleGroup.add("dropdownlist", undefined, []);
        styleDropdown.preferredSize.width = 270;

        var fauxBoldChk = pal.add("checkbox", undefined, "Use faux bold fallback if AE keeps Regular");
        fauxBoldChk.value = true;

        var status = pal.add("statictext", undefined, "Ready.", { multiline: true });
        status.preferredSize.height = 36;

        var btnRow = pal.add("group");
        btnRow.orientation = "row";
        btnRow.alignChildren = ["fill", "center"];
        var applyBtn = btnRow.add("button", undefined, "Apply to selected text layers");
        var refreshBtn = btnRow.add("button", undefined, "Refresh fonts");

        function refreshStylesForFamily() {
            while (styleDropdown.items.length > 0) {
                styleDropdown.remove(styleDropdown.items[0]);
            }

            if (!familyDropdown.selection) {
                status.text = "No family selected.";
                return;
            }

            var fam = familyDropdown.selection.text;
            var styles = fontsData.byFamily[fam] || [];
            var i;
            for (i = 0; i < styles.length; i++) {
                styleDropdown.add("item", styles[i].label);
            }

            if (styleDropdown.items.length > 0) {
                styleDropdown.selection = 0;
                status.text = "Selected: " + fam + " / " + styleDropdown.selection.text;
            } else {
                status.text = "No style available for: " + fam;
            }
        }

        familyDropdown.onChange = refreshStylesForFamily;

        applyBtn.onClick = function () {
            if (!familyDropdown.selection || !styleDropdown.selection) {
                safeAlert("Choose a family and style first.");
                return;
            }

            var fam = familyDropdown.selection.text;
            var styles = fontsData.byFamily[fam] || [];
            var styleEntry = styles[styleDropdown.selection.index];
            if (!styleEntry) {
                safeAlert("Invalid style selection.");
                return;
            }

            var sel = getSelectedTextLayers();
            if (!sel.ok) {
                safeAlert(sel.reason);
                status.text = sel.reason;
                return;
            }

            app.beginUndoGroup(SCRIPT_NAME);
            try {
                var i;
                for (i = 0; i < sel.layers.length; i++) {
                    applyFamilyStyleToLayer(sel.layers[i], fam, styleEntry, fauxBoldChk.value);
                }
            } catch (err) {
                app.endUndoGroup();
                safeAlert("Apply error:\n" + safeToString(err, "Unknown error."));
                status.text = "Error: " + safeToString(err, "Unknown error.");
                return;
            }
            app.endUndoGroup();

            status.text = "Applied " + fam + " / " + styleEntry.label + " to " + sel.layers.length + " layer(s).";
        };

        refreshBtn.onClick = function () {
            fontsData = collectFonts();
            while (familyDropdown.items.length > 0) {
                familyDropdown.remove(familyDropdown.items[0]);
            }

            var i;
            for (i = 0; i < fontsData.families.length; i++) {
                familyDropdown.add("item", fontsData.families[i]);
            }

            if (familyDropdown.items.length > 0) {
                familyDropdown.selection = 0;
            }
            refreshStylesForFamily();
        };

        if (familyDropdown.items.length > 0) {
            familyDropdown.selection = 0;
            refreshStylesForFamily();
        } else {
            status.text = "No fonts detected.";
        }

        pal.onResizing = pal.onResize = function () {
            this.layout.resize();
        };

        return pal;
    }

    try {
        var win = buildUI(thisObj);
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
    } catch (e) {
        safeAlert("Startup error:\n" + safeToString(e, "Unknown error."));
    }
})(this);
