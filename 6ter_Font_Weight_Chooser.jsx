/*
  6ter_Font_Weight_Chooser.jsx
  Simple After Effects ScriptUI panel to choose font family + weight/style
  and apply to selected text layers.
*/

(function fontWeightChooser(thisObj) {
    var SCRIPT_NAME = "6ter Font Weight Chooser";

    function safeAlert(msg) {
        var txt = msg ? String(msg) : "Unknown error.";
        alert(txt, SCRIPT_NAME);
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

    function collectFonts() {
        var out = {
            families: [],
            byFamily: {}
        };

        if (!app.fonts || app.fonts.length === 0) {
            return out;
        }

        var i;
        for (i = 0; i < app.fonts.length; i++) {
            var f = app.fonts[i];
            var family = String(f.familyName || f.name || "Unknown");
            var style = String(f.styleName || "Regular");

            if (!out.byFamily[family]) {
                out.byFamily[family] = [];
                out.families.push(family);
            }

            out.byFamily[family].push({
                label: style,
                postScriptName: String(f.postScriptName || ""),
                name: String(f.name || ""),
                fontObj: f
            });
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

    function applyFamilyStyleToLayer(layer, family, styleEntry) {
        var sourceText = layer.property("Source Text");
        if (!sourceText) {
            return;
        }

        var textDoc = sourceText.value;

        // Prefer explicit style assignment with fontObject when available.
        var assigned = false;
        try {
            if (textDoc.fontObject !== undefined && styleEntry.fontObj) {
                textDoc.fontObject = styleEntry.fontObj;
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
            textDoc.font = styleEntry.name;
            assigned = true;
        }

        if (!assigned) {
            throw new Error("Unable to apply style '" + styleEntry.label + "' for family '" + family + "'.");
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

        var title = pal.add("statictext", undefined, "Choose family and weight/style");

        var famGroup = pal.add("group");
        famGroup.orientation = "row";
        famGroup.alignChildren = ["left", "center"];
        famGroup.add("statictext", undefined, "Family:");
        var familyDropdown = famGroup.add("dropdownlist", undefined, fontsData.families);
        familyDropdown.preferredSize.width = 260;

        var styleGroup = pal.add("group");
        styleGroup.orientation = "row";
        styleGroup.alignChildren = ["left", "center"];
        styleGroup.add("statictext", undefined, "Style:");
        var styleDropdown = styleGroup.add("dropdownlist", undefined, []);
        styleDropdown.preferredSize.width = 260;

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
                    applyFamilyStyleToLayer(sel.layers[i], fam, styleEntry);
                }
            } catch (err) {
                app.endUndoGroup();
                safeAlert("Apply error:\n" + String(err));
                status.text = "Error: " + String(err);
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
            status.text = "No fonts detected via app.fonts.";
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
        safeAlert("Startup error:\n" + String(e));
    }
})(this);
