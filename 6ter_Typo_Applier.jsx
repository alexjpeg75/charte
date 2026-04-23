/*
  6ter_Typo_Applier.jsx
  Dockable ScriptUI panel for applying 6ter typography presets to selected text layers.
*/

(function sixterTypoApplier(thisObj) {
    var SCRIPT_NAME = "6ter Typo Applier";

    // Map logical font keys to one or more candidate names expected by After Effects.
    // You can provide a string or an array of aliases (family/style/PostScript variants).
    // If AE uses different names on your machine, edit these values.
    var FONT_MAP = {
        "Andes Medium": ["Andes Medium", "Andes-Medium", "Andes Medium Regular"],
        "Andes Black": ["Andes Black", "Andes-Black"],
        "Andes Bold": ["Andes Bold", "Andes-Bold"],
        "Bemio Regular": ["Bemio Regular", "Bemio-Regular", "Bemio"]
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

    function safeToString(value, fallback) {
        if (fallback === undefined) {
            fallback = "Erreur inconnue.";
        }
        if (value === undefined || value === null) {
            return fallback;
        }
        var str = "";
        try {
            if (value.toString) {
                str = value.toString();
            } else {
                str = String(value);
            }
        } catch (e) {
            str = "";
        }
        if (!str || str === "undefined" || str === "null") {
            return fallback;
        }
        return str;
    }

    function safeAlert(message, title) {
        var msg = safeToString(message, "Une erreur est survenue. Consulte le panneau Statut.");
        try {
            alert(msg, title || SCRIPT_NAME);
        } catch (e) {
            // Last resort for hosts with strict alert behavior.
            alert("Une erreur est survenue.", SCRIPT_NAME);
        }
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

    function normalizeFontName(name) {
        return String(name || "").toLowerCase().replace(/[\s_\-]+/g, "");
    }

    function getFontAliases(fontKey) {
        var rawMap = FONT_MAP[fontKey];
        var aliases = [];
        var i;

        if (rawMap instanceof Array) {
            for (i = 0; i < rawMap.length; i++) {
                aliases.push(String(rawMap[i]));
            }
        } else if (rawMap !== undefined && rawMap !== null) {
            aliases.push(String(rawMap));
        } else {
            aliases.push(String(fontKey));
        }

        return aliases;
    }

    function getExpectedStyleTokens(fontKey, aliases) {
        var src = (String(fontKey || "") + " " + aliases.join(" ")).toLowerCase();
        var tokens = [];
        if (src.indexOf("black") !== -1 || src.indexOf("heavy") !== -1) { tokens.push("black"); }
        if (src.indexOf("bold") !== -1) { tokens.push("bold"); }
        if (src.indexOf("medium") !== -1) { tokens.push("medium"); }
        if (src.indexOf("regular") !== -1 || src.indexOf("roman") !== -1 || src.indexOf("book") !== -1) { tokens.push("regular"); }
        return tokens;
    }

    function scoreStyleMatch(fontObj, expectedStyleTokens) {
        if (!expectedStyleTokens || expectedStyleTokens.length === 0) {
            return 0;
        }

        var haystack = (
            String(fontObj.styleName || "") + " " +
            String(fontObj.postScriptName || "") + " " +
            String(fontObj.name || "")
        ).toLowerCase();

        var score = 0;
        var i;
        for (i = 0; i < expectedStyleTokens.length; i++) {
            if (haystack.indexOf(expectedStyleTokens[i]) !== -1) {
                score += 20;
            }
        }

        // Penalize known wrong weights when a specific one is requested.
        if (expectedStyleTokens.indexOf("bold") !== -1 && haystack.indexOf("medium") !== -1) { score -= 15; }
        if (expectedStyleTokens.indexOf("bold") !== -1 && haystack.indexOf("regular") !== -1) { score -= 20; }
        if (expectedStyleTokens.indexOf("black") !== -1 && haystack.indexOf("medium") !== -1) { score -= 20; }
        if (expectedStyleTokens.indexOf("black") !== -1 && haystack.indexOf("regular") !== -1) { score -= 25; }
        if (expectedStyleTokens.indexOf("medium") !== -1 && haystack.indexOf("bold") !== -1) { score -= 12; }

        return score;
    }

    function doesAssignedStyleMatch(textDoc, expectedStyleTokens) {
        if (!expectedStyleTokens || expectedStyleTokens.length === 0) {
            return true;
        }

        var assigned = (
            String(textDoc.font || "") + " " +
            String(textDoc.fontFamily || "") + " " +
            String(textDoc.fontStyle || "")
        ).toLowerCase();

        if (expectedStyleTokens.indexOf("bold") !== -1 && assigned.indexOf("bold") === -1) {
            return false;
        }
        if (expectedStyleTokens.indexOf("black") !== -1 && assigned.indexOf("black") === -1 && assigned.indexOf("heavy") === -1) {
            return false;
        }
        if (expectedStyleTokens.indexOf("medium") !== -1 && assigned.indexOf("medium") === -1) {
            return false;
        }

        return true;
    }

    function resolveFont(fontKey) {
        var aliases = getFontAliases(fontKey);
        var aliasNorm = [];
        var i;
        for (i = 0; i < aliases.length; i++) {
            aliasNorm.push(normalizeFontName(aliases[i]));
        }

        var expectedStyleTokens = getExpectedStyleTokens(fontKey, aliases);
        var matches = [];
        var fallbackString = aliases[0];

        if (!app.fonts || app.fonts.length === 0) {
            return { ok: true, requested: fontKey, aliases: aliases, matches: matches, fallbackString: fallbackString, expectedStyleTokens: expectedStyleTokens };
        }

        var seen = {};
        var f, fields, key, candidate, normCandidate, a, weight, styleScore;
        for (i = 0; i < app.fonts.length; i++) {
            f = app.fonts[i];
            fields = [f.postScriptName, f.name, f.familyName, f.styleName];

            for (var fi = 0; fi < fields.length; fi++) {
                candidate = fields[fi];
                if (!candidate) { continue; }
                normCandidate = normalizeFontName(candidate);
                weight = -1;

                for (a = 0; a < aliasNorm.length; a++) {
                    if (normCandidate === aliasNorm[a]) {
                        weight = 100;
                        break;
                    }
                    if (normCandidate.indexOf(aliasNorm[a]) !== -1 || aliasNorm[a].indexOf(normCandidate) !== -1) {
                        if (weight < 60) { weight = 60; }
                    }
                }

                if (weight > -1) {
                    styleScore = scoreStyleMatch(f, expectedStyleTokens);
                    key = String(f.postScriptName || "") + "|" + String(f.name || "") + "|" + String(f.familyName || "") + "|" + String(f.styleName || "");
                    if (!seen[key]) {
                        seen[key] = true;
                        matches.push({
                            fontObj: f,
                            weight: weight + styleScore,
                            postScriptName: f.postScriptName,
                            name: f.name,
                            familyName: f.familyName,
                            styleName: f.styleName
                        });
                    }
                }
            }
        }

        if (matches.length > 1) {
            matches.sort(function (a, b) {
                return b.weight - a.weight;
            });
        }

        return { ok: true, requested: fontKey, aliases: aliases, matches: matches, fallbackString: fallbackString, expectedStyleTokens: expectedStyleTokens };
    }

    function tryAssignFont(textDoc, resolvedFont) {
        var i;
        var tried = [];
        var expectedStyleTokens = resolvedFont.expectedStyleTokens || [];

        // IMPORTANT: prefer concrete installed matches first (weight/style-aware),
        // then fallback to raw alias strings. This avoids AE resolving family-only
        // names (ex: Andes) to Regular by default.

        // 1) Best installed matches first: fontObject -> postScriptName -> name.
        for (i = 0; i < resolvedFont.matches.length; i++) {
            var m = resolvedFont.matches[i];

            try {
                if (textDoc.fontObject !== undefined && m.fontObj) {
                    textDoc.fontObject = m.fontObj;
                    if (doesAssignedStyleMatch(textDoc, expectedStyleTokens)) {
                        return {
                            ok: true,
                            used: m.postScriptName || m.name || "fontObject",
                            mode: "fontObject",
                            styleName: m.styleName || ""
                        };
                    }
                    tried.push("fontObject-mismatch:" + (m.postScriptName || m.name || "unknown"));
                }
            } catch (eObj) {
                tried.push("fontObject:" + (m.postScriptName || m.name || "unknown"));
            }

            if (m.postScriptName) {
                try {
                    textDoc.font = m.postScriptName;
                    if (doesAssignedStyleMatch(textDoc, expectedStyleTokens)) {
                        return { ok: true, used: m.postScriptName, mode: "postScriptName", styleName: m.styleName || "" };
                    }
                    tried.push("postScriptName-mismatch:" + m.postScriptName);
                } catch (ePs) {
                    tried.push(m.postScriptName);
                }
            }

            if (m.name) {
                try {
                    textDoc.font = m.name;
                    if (doesAssignedStyleMatch(textDoc, expectedStyleTokens)) {
                        return { ok: true, used: m.name, mode: "name", styleName: m.styleName || "" };
                    }
                    tried.push("name-mismatch:" + m.name);
                } catch (eName) {
                    tried.push(m.name);
                }
            }
        }

        // 2) Fallback aliases from FONT_MAP.
        for (i = 0; i < resolvedFont.aliases.length; i++) {
            try {
                textDoc.font = resolvedFont.aliases[i];
                if (doesAssignedStyleMatch(textDoc, expectedStyleTokens)) {
                    return { ok: true, used: resolvedFont.aliases[i], mode: "alias", styleName: "" };
                }
                tried.push("alias-mismatch:" + resolvedFont.aliases[i]);
            } catch (eAlias) {
                tried.push(resolvedFont.aliases[i]);
            }
        }

        // 3) Last fallback to primary alias.
        try {
            textDoc.font = resolvedFont.fallbackString;
            if (doesAssignedStyleMatch(textDoc, expectedStyleTokens)) {
                return { ok: true, used: resolvedFont.fallbackString, mode: "fallback", styleName: "" };
            }
            tried.push("fallback-mismatch:" + resolvedFont.fallbackString);
        } catch (eFallback) {
            tried.push(resolvedFont.fallbackString);
        }

        return { ok: false, used: "", mode: "none", styleName: "", tried: tried };
    }

    function applyStyleToLayer(layer, preset) {
        var sourceTextProp = layer.property("Source Text");
        if (!sourceTextProp) {
            return;
        }

        var textDoc = sourceTextProp.value;
        var fontResult = resolveFont(preset.fontKey);
        var assignment = tryAssignFont(textDoc, fontResult);
        if (!assignment.ok) {
            throw new Error("Police introuvable : " + preset.fontKey + " (tests: " + assignment.tried.join(", ") + ").");
        }

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
            safeAlert("S\u00E9lectionne un preset avant d'appliquer.", SCRIPT_NAME);
            return;
        }

        var sel = getSelectedTextLayers();
        if (!sel.ok) {
            safeAlert(sel.reason, SCRIPT_NAME);
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
            safeAlert("Erreur pendant l'application du style :\n" + safeToString(err, "Erreur inconnue."), SCRIPT_NAME);
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
            safeAlert(msg, SCRIPT_NAME);
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
            var card = uiState.cardRows[i];
            var isSelected = (card.presetId === uiState.selectedPresetId);
            card.text = isSelected ? "Preset selectionne" : "";
            card.enabled = true;
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

            var card = uiState.listContent.add("panel", undefined, "");
            card.orientation = "column";
            card.alignChildren = ["fill", "top"];
            card.margins = [10, 10, 10, 10];
            card.spacing = 4;
            card.preferredSize.height = 100;
            card.presetId = preset.id;

            var top = card.add("group");
            top.orientation = "row";
            top.alignChildren = ["left", "center"];
            top.spacing = 8;

            var title = top.add("statictext", undefined, preset.label);
            title.characters = 28;

            var swatch = top.add("panel", undefined, "");
            swatch.preferredSize = [20, 12];
            swatch.helpTip = "RGB " + preset.fillColor[0] + "," + preset.fillColor[1] + "," + preset.fillColor[2];

            var meta = card.add("statictext", undefined, formatPresetLine(preset));
            var sample = card.add("statictext", undefined, "Exemple : " + preset.sample);

            var applyBtn = card.add("button", undefined, "Appliquer ce preset");

            (function (presetRef, cardRef) {
                function chooseAndApply() {
                    uiState.selectedPresetId = presetRef.id;
                    refreshCardSelectionStyles();
                    setStatus("Preset selectionne : " + presetRef.label + " (application immediate)", false);
                    applySelectedPreset();
                }
                applyBtn.onClick = chooseAndApply;
                if (cardRef.addEventListener) { cardRef.addEventListener("click", chooseAndApply); }
                if (top.addEventListener) { top.addEventListener("click", chooseAndApply); }
                if (title.addEventListener) { title.addEventListener("click", chooseAndApply); }
                if (meta.addEventListener) { meta.addEventListener("click", chooseAndApply); }
                if (sample.addEventListener) { sample.addEventListener("click", chooseAndApply); }
                if (swatch.addEventListener) { swatch.addEventListener("click", chooseAndApply); }
            })(preset, card);

            uiState.cardRows.push(card);
        }

        uiState.listContent.layout.layout(true);
        updateScrollbar();
        refreshCardSelectionStyles();
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

    try {
        var myPal = buildUI(thisObj);
        if (myPal instanceof Window) {
            myPal.center();
            myPal.show();
        } else {
            myPal.layout.layout(true);
        }
    } catch (bootErr) {
        safeAlert("Erreur au lancement du panneau :\n" + safeToString(bootErr, "Erreur inconnue."), SCRIPT_NAME);
    }
})(this);
