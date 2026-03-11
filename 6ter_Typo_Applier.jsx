/*
  6ter_Typo_Applier.jsx
  Dockable ScriptUI panel for applying 6ter typography presets to selected text layers.
*/

(function sixterTypoApplier(thisObj) {
    var SCRIPT_NAME = "6ter Typo Applier";

    // Map logical font keys to exact font names expected by After Effects on your machine.
    // If styles fail to apply, update the values below (often PostScript names are required).
    var FONT_MAP = {
        "Andes Medium": "Andes Medium",
        "Andes Black": "Andes Black",
        "Andes Bold": "Andes Bold",
        "Bemio Regular": "Bemio Regular"
    };

    var STYLE_PRESETS = [
        { id: "rdv_bug_noir", label: "Rendez-vous bug", fontKey: "Andes Bold", fontSize: 27, tracking: -20, leading: null, fillColor: [0, 0, 0], category: "Bug", sample: "Rendez-vous" },
        { id: "nom_programme_bemio", label: "Nom programme Bemio", fontKey: "Bemio Regular", fontSize: 37, tracking: -20, leading: 28, fillColor: [255, 255, 255], category: "Bug", sample: "Nom du programme" },
        { id: "typo_deroulante", label: "Typo d\u00E9roulante", fontKey: "Andes Medium", fontSize: 30, tracking: -10, leading: 32, fillColor: [255, 255, 255], category: "D\u00E9roulant", sample: "Texte d\u00E9roulant" },
        { id: "a_suivre_blanc", label: "\u00C0 suivre", fontKey: "Andes Medium", fontSize: 30, tracking: -10, leading: null, fillColor: [255, 255, 255], category: "A suivre", sample: "\u00C0 suivre" },
        { id: "nom_programme_jaune", label: "Nom programme jaune", fontKey: "Andes Black", fontSize: 30, tracking: 15, leading: 30, fillColor: [253, 237, 136], category: "Programme", sample: "Nom programme" },
        { id: "phrase_editoriale", label: "Phrase \u00E9ditoriale", fontKey: "Andes Medium", fontSize: 30, tracking: 0, leading: 30, fillColor: [255, 255, 255], category: "\u00C9dito", sample: "Phrase \u00E9ditoriale" },
        { id: "rdv_jaune", label: "Rendez-vous jaune", fontKey: "Andes Medium", fontSize: 30, tracking: 0, leading: 30, fillColor: [253, 237, 136], category: "\u00C9dito", sample: "Rendez-vous" },
        { id: "on_regarde", label: "On regarde", fontKey: "Andes Medium", fontSize: 30, tracking: -10, leading: null, fillColor: [255, 255, 255], category: "Programme", sample: "On regarde" },
        { id: "hashtag", label: "Hashtag", fontKey: "Andes Medium", fontSize: 30, tracking: -10, leading: 30, fillColor: [255, 255, 255], category: "D\u00E9roulant", sample: "#Hashtag" },
        { id: "bandeau_deroulant", label: "Bandeau d\u00E9roulant", fontKey: "Andes Medium", fontSize: 25.6, tracking: -10, leading: 32, fillColor: [255, 255, 255], category: "D\u00E9roulant", sample: "Bandeau d\u00E9roulant" },
        { id: "dans_un_instant", label: "Dans un instant", fontKey: "Andes Medium", fontSize: 40, tracking: -10, leading: 30, fillColor: [254, 238, 137], category: "Fin", sample: "Dans un instant" },
        { id: "nom_programme_fin", label: "Nom programme fin", fontKey: "Bemio Regular", fontSize: 43, tracking: -20, leading: 40, fillColor: [255, 255, 255], category: "Fin", sample: "Nom programme" },
        { id: "texte_editorialisable", label: "Texte \u00E9ditorialisable", fontKey: "Andes Medium", fontSize: 42.4, tracking: -10, leading: 45, fillColor: [255, 255, 255], category: "Fin", sample: "Texte \u00E9ditorialisable" }
    ];

    var CATEGORIES = ["Tous", "Bug", "A suivre", "Programme", "\u00C9dito", "D\u00E9roulant", "Fin"];

    var uiState = {
        selectedPresetId: null,
        selectedCategory: "Tous",
        cardRows: [],
        viewport: null,
        listContent: null,
        scrollbar: null,
        statusText: null
    };

    function rgb255ToAE(rgb) {
        return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
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
            return { ok: false, reason: "Aucune composition active. Ouvre une comp puis r\u00E9essaie.", layers: [] };
        }

        var layers = comp.selectedLayers;
        var textLayers = [];
        var i;
        for (i = 0; i < layers.length; i++) {
            if (layers[i].property("Source Text") !== null) {
                textLayers.push(layers[i]);
            }
        }

        if (textLayers.length === 0) {
            return { ok: false, reason: "Aucun calque texte s\u00E9lectionn\u00E9. S\u00E9lectionne au moins un calque texte.", layers: [] };
        }

        return { ok: true, reason: "", layers: textLayers };
    }

    function resolveFont(fontKey) {
        var mappedName = FONT_MAP[fontKey] || fontKey;
        var normalized = mappedName.toLowerCase();

        if (!app.fonts || app.fonts.length === 0) {
            return { ok: true, requested: fontKey, fontName: mappedName };
        }

        var i;
        for (i = 0; i < app.fonts.length; i++) {
            var f = app.fonts[i];
            var candidates = [];
            if (f.name) { candidates.push(f.name); }
            if (f.postScriptName) { candidates.push(f.postScriptName); }
            if (f.familyName) { candidates.push(f.familyName); }
            if (f.styleName) { candidates.push(f.styleName); }
            var j;
            for (j = 0; j < candidates.length; j++) {
                if (String(candidates[j]).toLowerCase() === normalized) {
                    return { ok: true, requested: fontKey, fontName: mappedName };
                }
            }
        }

        return { ok: false, requested: fontKey, fontName: mappedName };
    }

    function applyStyleToLayer(layer, preset) {
        var sourceTextProp = layer.property("Source Text");
        if (!sourceTextProp) {
            return;
        }

        var textDoc = sourceTextProp.value;
        var fontResult = resolveFont(preset.fontKey);
        if (!fontResult.ok) {
            throw new Error("Police introuvable : " + preset.fontKey + " (mapp\u00E9e vers \"" + fontResult.fontName + "\").");
        }

        textDoc.font = fontResult.fontName;
        textDoc.fontSize = preset.fontSize;
        textDoc.tracking = preset.tracking;
        textDoc.applyFill = true;
        textDoc.fillColor = rgb255ToAE(preset.fillColor);

        if (preset.leading !== null && preset.leading !== undefined) {
            textDoc.autoLeading = false;
            textDoc.leading = preset.leading;
        }

        sourceTextProp.setValue(textDoc);
    }

    function findPresetById(id) {
        var i;
        for (i = 0; i < STYLE_PRESETS.length; i++) {
            if (STYLE_PRESETS[i].id === id) {
                return STYLE_PRESETS[i];
            }
        }
        return null;
    }

    function formatPresetLine(preset) {
        var leadingPart = (preset.leading !== null && preset.leading !== undefined) ? (" / leading " + preset.leading) : "";
        return preset.fontKey + " \u2022 " + preset.fontSize + " pt \u2022 tracking " + preset.tracking + leadingPart;
    }

    function setStatus(message, isError) {
        if (uiState.statusText) {
            uiState.statusText.text = message;
            uiState.statusText.graphics.foregroundColor = uiState.statusText.graphics.newPen(
                uiState.statusText.graphics.PenType.SOLID_COLOR,
                isError ? [1, 0.35, 0.35, 1] : [0.72, 0.78, 0.88, 1],
                1
            );
        }
    }

    function applySelectedPreset() {
        var preset = findPresetById(uiState.selectedPresetId);
        if (!preset) {
            alert("S\u00E9lectionne un preset avant d'appliquer.", SCRIPT_NAME);
            return;
        }

        var sel = getSelectedTextLayers();
        if (!sel.ok) {
            alert(sel.reason, SCRIPT_NAME);
            setStatus(sel.reason, true);
            return;
        }

        var missingFonts = {};
        var i;

        app.beginUndoGroup(SCRIPT_NAME + " - " + preset.label);
        try {
            for (i = 0; i < sel.layers.length; i++) {
                try {
                    applyStyleToLayer(sel.layers[i], preset);
                } catch (e) {
                    if (String(e).indexOf("Police introuvable") === 0) {
                        missingFonts[preset.fontKey] = true;
                    } else {
                        throw e;
                    }
                }
            }
        } catch (err) {
            app.endUndoGroup();
            alert("Erreur pendant l'application du style :\n" + err.toString(), SCRIPT_NAME);
            setStatus("Erreur : " + err.toString(), true);
            return;
        }
        app.endUndoGroup();

        var missing = [];
        for (var k in missingFonts) {
            if (missingFonts.hasOwnProperty(k)) {
                missing.push(k + " (mapping: " + (FONT_MAP[k] || k) + ")");
            }
        }

        if (missing.length > 0) {
            var msg = "Style appliqu\u00E9 partiellement. Police(s) manquante(s) :\n- " + missing.join("\n- ");
            alert(msg, SCRIPT_NAME);
            setStatus("Attention : police manquante pour " + preset.label, true);
        } else {
            setStatus("Appliqu\u00E9 : " + preset.label + " sur " + sel.layers.length + " calque(s).", false);
        }
    }

    function getVisiblePresets() {
        var out = [];
        var i;
        for (i = 0; i < STYLE_PRESETS.length; i++) {
            if (uiState.selectedCategory === "Tous" || STYLE_PRESETS[i].category === uiState.selectedCategory) {
                out.push(STYLE_PRESETS[i]);
            }
        }
        return out;
    }

    function refreshCardSelectionStyles() {
        var i;
        for (i = 0; i < uiState.cardRows.length; i++) {
            uiState.cardRows[i].notify("onDraw");
        }
    }

    function attachClickHandlers(card, preset) {
        function clickHandler() {
            uiState.selectedPresetId = preset.id;
            refreshCardSelectionStyles();
            setStatus("Preset s\u00E9lectionn\u00E9 : " + preset.label + " (application imm\u00E9diate)", false);
            applySelectedPreset();
        }

        function recurse(node) {
            node.addEventListener("click", clickHandler);
            if (node.children && node.children.length > 0) {
                var i;
                for (i = 0; i < node.children.length; i++) {
                    recurse(node.children[i]);
                }
            }
        }

        recurse(card);
    }

    function buildCards() {
        while (uiState.listContent.children.length > 0) {
            uiState.listContent.remove(uiState.listContent.children[0]);
        }
        uiState.cardRows = [];

        var presets = getVisiblePresets();
        var i;
        for (i = 0; i < presets.length; i++) {
            var preset = presets[i];
            var card = uiState.listContent.add("group");
            card.orientation = "column";
            card.alignChildren = ["fill", "top"];
            card.margins = [12, 10, 12, 10];
            card.spacing = 5;
            card.preferredSize.height = 92;
            card.presetId = preset.id;

            card.onDraw = function () {
                var selected = (this.presetId === uiState.selectedPresetId);
                var bg = selected ? [0.20, 0.25, 0.34, 1] : [0.13, 0.15, 0.19, 1];
                var border = selected ? [0.98, 0.92, 0.54, 1] : [0.24, 0.27, 0.33, 1];
                this.graphics.rectPath(0, 0, this.size.width, this.size.height);
                this.graphics.fillPath(this.graphics.newBrush(this.graphics.BrushType.SOLID_COLOR, bg));
                this.graphics.rectPath(0.5, 0.5, this.size.width - 1, this.size.height - 1);
                this.graphics.strokePath(this.graphics.newPen(this.graphics.PenType.SOLID_COLOR, border, selected ? 2 : 1));
            };

            var top = card.add("group");
            top.orientation = "row";
            top.alignChildren = ["left", "center"];

            var title = top.add("statictext", undefined, preset.label);
            title.graphics.foregroundColor = title.graphics.newPen(title.graphics.PenType.SOLID_COLOR, [0.96, 0.97, 1.0, 1], 1);
            title.characters = 26;

            var swatch = top.add("panel", undefined, "");
            swatch.preferredSize = [22, 14];
            swatch.rgb = rgb255ToAE(preset.fillColor);
            swatch.onDraw = function () {
                this.graphics.rectPath(0, 0, this.size.width, this.size.height);
                this.graphics.fillPath(this.graphics.newBrush(this.graphics.BrushType.SOLID_COLOR, [this.rgb[0], this.rgb[1], this.rgb[2], 1]));
                this.graphics.rectPath(0.5, 0.5, this.size.width - 1, this.size.height - 1);
                this.graphics.strokePath(this.graphics.newPen(this.graphics.PenType.SOLID_COLOR, [0, 0, 0, 0.6], 1));
            };

            var meta = card.add("statictext", undefined, formatPresetLine(preset));
            meta.graphics.foregroundColor = meta.graphics.newPen(meta.graphics.PenType.SOLID_COLOR, [0.72, 0.78, 0.88, 1], 1);

            var sample = card.add("statictext", undefined, "Exemple : " + preset.sample);
            sample.graphics.foregroundColor = sample.graphics.newPen(sample.graphics.PenType.SOLID_COLOR, [0.86, 0.89, 0.95, 1], 1);

            attachClickHandlers(card, preset);
            uiState.cardRows.push(card);
        }

        uiState.listContent.layout.layout(true);
        updateScrollbar();
    }

    function updateScrollbar() {
        if (!uiState.viewport || !uiState.listContent || !uiState.scrollbar) {
            return;
        }

        // Some AE versions can briefly expose undefined size/location objects during first layout.
        // Guard every access so the panel never throws "undefined is not an object".
        var contentSize = uiState.listContent.size;
        var viewSize = uiState.viewport.size;
        if (!contentSize || !viewSize) {
            uiState.scrollbar.visible = false;
            return;
        }

        var contentH = contentSize.height;
        var viewH = viewSize.height;

        if (contentH <= viewH) {
            uiState.scrollbar.visible = false;
            if (uiState.listContent.location) {
                uiState.listContent.location.y = 0;
            }
            return;
        }

        uiState.scrollbar.visible = true;
        uiState.scrollbar.minvalue = 0;
        uiState.scrollbar.maxvalue = contentH - viewH;
        if (uiState.scrollbar.value > uiState.scrollbar.maxvalue) {
            uiState.scrollbar.value = uiState.scrollbar.maxvalue;
        }
        if (uiState.listContent.location) {
            uiState.listContent.location.y = -uiState.scrollbar.value;
        }
    }

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 10;
        pal.margins = 14;

        var header = pal.add("group");
        header.orientation = "column";
        header.alignChildren = ["left", "top"];
        header.spacing = 2;

        var title = header.add("statictext", undefined, SCRIPT_NAME);
        title.graphics.font = ScriptUI.newFont("Arial", "Bold", 18);

        var subtitle = header.add("statictext", undefined, "Styles de charte 6ter \u2014 application rapide");
        subtitle.graphics.foregroundColor = subtitle.graphics.newPen(subtitle.graphics.PenType.SOLID_COLOR, [0.70, 0.74, 0.82, 1], 1);

        var filterRow = pal.add("group");
        filterRow.orientation = "row";
        filterRow.alignChildren = ["left", "center"];

        filterRow.add("statictext", undefined, "Cat\u00E9gorie :");
        var categoryDropdown = filterRow.add("dropdownlist", undefined, CATEGORIES);
        categoryDropdown.selection = 0;
        categoryDropdown.preferredSize.width = 160;

        var cardsWrap = pal.add("group");
        cardsWrap.orientation = "row";
        cardsWrap.alignChildren = ["fill", "fill"];
        cardsWrap.spacing = 6;
        cardsWrap.preferredSize = [520, 380];

        var viewport = cardsWrap.add("group");
        viewport.orientation = "column";
        viewport.alignChildren = ["fill", "top"];
        viewport.margins = 0;

        var listContent = viewport.add("group");
        listContent.orientation = "column";
        listContent.alignChildren = ["fill", "top"];
        listContent.spacing = 8;
        listContent.margins = 0;

        var scrollbar = cardsWrap.add("scrollbar");
        scrollbar.preferredSize.width = 16;

        uiState.viewport = viewport;
        uiState.listContent = listContent;
        uiState.scrollbar = scrollbar;

        scrollbar.onChanging = function () {
            if (uiState.listContent && uiState.listContent.location) {
                uiState.listContent.location.y = -this.value;
            }
        };

        categoryDropdown.onChange = function () {
            uiState.selectedCategory = this.selection ? this.selection.text : "Tous";
            buildCards();
        };

        var actions = pal.add("group");
        actions.orientation = "row";
        actions.alignChildren = ["fill", "center"];

        var applyBtn = actions.add("button", undefined, "Appliquer au(x) calque(s) s\u00E9lectionn\u00E9(s)");
        var refreshBtn = actions.add("button", undefined, "Rafra\u00EEchir s\u00E9lection");

        applyBtn.onClick = function () {
            applySelectedPreset();
        };

        refreshBtn.onClick = function () {
            buildCards();
            setStatus("S\u00E9lection visuelle rafra\u00EEchie.", false);
        };

        var statusPanel = pal.add("panel", undefined, "Statut");
        statusPanel.alignChildren = ["fill", "top"];
        statusPanel.margins = [10, 16, 10, 10];
        var statusText = statusPanel.add("statictext", undefined, "Pr\u00EAt. Choisis un preset puis clique une carte.", { multiline: true });
        statusText.preferredSize.height = 34;
        uiState.statusText = statusText;

        pal.onResizing = pal.onResize = function () {
            this.layout.resize();
            updateScrollbar();
        };

        buildCards();
        setStatus("Pr\u00EAt. S\u00E9lectionne un ou plusieurs calques texte puis clique un preset.", false);

        return pal;
    }

    var myPal = buildUI(thisObj);
    if (myPal instanceof Window) {
        myPal.center();
        myPal.show();
    } else {
        myPal.layout.layout(true);
    }
})(this);
