// -----------------------------------------------------------------
// TEXT COMMANDS
// -----------------------------------------------------------------

Cu.import("resource://gre/modules/Services.jsm")

var H = Utils.escapeHtml;

/* Note that these text formatting commands are a little weird in that
 * they operate on a selection, but they don't take the selection as
 * an argument.  This is as intended, because if there is no text
 * selection, there is nothing for any of these commands to do.
 */
(function textFormattingCommand(format, desc, icon, name) {
  var xxdo = /do$/.test(format), tag = format[0] + ">";
  CmdUtils.CreateCommand({
    names: [name || format],
    description: desc + ".",
    icon: "chrome://ubiquity/skin/icons/" + icon + ".png",
    execute: function txtfmt_execute() {
      var doc = context.focusedWindow.document;
      if (doc.designMode === "on")
        doc.execCommand(format, false, null);
      else if (xxdo)
        context.chromeWindow.document
          .getElementById("cmd_" + format).doCommand();
      else {
        let htm = "<" + tag + CmdUtils.htmlSelection + "</" + tag;
        CmdUtils.setSelection(htm, {text: htm});
      }
    }
  });
  return arguments.callee;
})
("bold", "Makes the selected text bold", "text_bold")
("italic", "Makes the selected text italic", "text_italic", "italicize")
("underline", "Underlines the selected text", "text_underline")
("undo", "Undoes your latest style/formatting or page-editing changes",
 "arrow_undo", "undo text edit")
("redo", "Redoes your latest style/formatting or page-editing changes",
 "arrow_redo", "redo text edit")
;

CmdUtils.CreateCommand({
  names: ["highlight", "hilite"],
  description: (
    'Highlights your current selection, ' +
    'like <span style="background: yellow; color: black;">this</span>.'),
  icon: "chrome://ubiquity/skin/icons/textfield_rename.png",
  execute: function hilite_execute() {
    var win = context.focusedWindow;
    var doc = win.document;
    var sel = win.getSelection();
    for (var i = sel.rangeCount; i--;) {
      var range = sel.getRangeAt(i);
      var newNode = doc.createElement("span");
      var {style} = newNode;
      style.background = "yellow";
      style.color = "black";
      range.surroundContents(newNode);
    }
  }
});

const NUM_WORDS = _("${num} words.");

var wordCount = t => (t.match(/\S+/g) || "").length

CmdUtils.CreateCommand({
  names: ["count words", "word count"],
  arguments: {object: noun_arb_text},
  icon: "chrome://ubiquity/skin/icons/sum.png",
  description: "Displays the number of words in a selection.",
  execute: function ({object: {text}}) {
    displayMessage(
      text
      ? _(NUM_WORDS, {num: wordCount(text)})
      : _("No words selected."),
      this);
  },
  preview: function (pb, {object: {text}}) {
    pb.innerHTML = (
      text
      ? _(NUM_WORDS, {num: "<strong>" + wordCount(text) + "</strong>"})
      : this.previewDefault());
  }
});

/* TODO the dummy argument "wikipedia" could become a plugin argument
 * and this command could become a general purpose "insert link"
 * command.
 */
CmdUtils.CreateCommand({
  names: ["link to Wikipedia"],
  arguments: {
    object: noun_arb_text,
    format: noun_type_lang_wikipedia,
  },
  description:
  "Turns a phrase into a link to the matching Wikipedia article.",
  icon: "chrome://ubiquity/skin/icons/wikipedia.ico",
  _link: function({object: {text, html}, format: {data}}){
    var url = ("http://" + (data || "en") +
               ".wikipedia.org/wiki/Special%3ASearch/" +
               encodeURIComponent(text.replace(/ /g, "_")));
    return ['<a href="' + Utils.escapeHtml(url) + '">' + html + "</a>", url];
  },
  execute: function (args) {
    var [htm, url] = this._link(args);
    CmdUtils.setSelection(htm, {text: url});
  },
  preview: function (pbl, args) {
    var [htm, url] = this._link(args);
    pbl.innerHTML =
      this.previewDefault() +
      (htm && "<p>" + htm + "</p><code>" + Utils.escapeHtml(url) + "</code>");
  }
});

// -----------------------------------------------------------------
// CALCULATE COMMANDS
// -----------------------------------------------------------------

const noun_calc = {
  label: "expression",
  suggest: function (txt, htm, cb, si) {
    if (!this._mathlike.test(txt)) return []
    try {
      var result = this.Parser.evaluate(txt)
        , score  = result === txt ? .3 : 1
    }
    catch (e) {
      result = e.message
      score  = .1
    }
    return [CmdUtils.makeSugg(txt, htm, result, score, si)];
  },
  _mathlike: /^[\w.+\-*\/^%(, )|]+$/,
}
Services.scriptloader.loadSubScript
("resource://ubiquity/scripts/math_parser.js", noun_calc)

CmdUtils.CreateCommand({
  names: "calculate",
  description:
    'Calculates using\
     <a href="http://silentmatt.com/javascript-expression-evaluator/">\
     JavaScript Expression Evaluator</a>.',
  help: "Try: <code>22/7, 3^4^5, sin(sqrt(log(PI)))</code>",
  icon: "chrome://ubiquity/skin/icons/calculator.png",
  author: "satyr",
  license: "Public domain",
  argument: noun_calc,
  execute: function ({object: {data, score}}) {
    if (score > .3) CmdUtils.setSelection(data)
    displayMessage(data)
  },
  preview: function (pb, {object: {data, score}}) {
    pb.innerHTML = (score < .3 ? "<em class=error>" : "<strong>") + data
  },
})

// -----------------------------------------------------------------
// TRANSLATE COMMANDS
// -----------------------------------------------------------------

const PREF_LANG_DEFAULT = "extensions.ubiquity.translate.lang.default"
    , PREF_LANG_ALT     = "extensions.ubiquity.translate.lang.alt"

const MS_TRANSLATOR_LIMIT = 1e4
    , MS_LANGS     = {}
    , MS_LANGS_REV =
      { ar: "Arabic"
      , bg: "Bulgarian"
      , ca: "Catalan"
      , cs: "Czech"
      , da: "Danish"
      , nl: "Dutch"
      , en: "English"
      , et: "Estonian"
      , fi: "Finnish"
      , fr: "French"
      , de: "German"
      , el: "Greek"
      , he: "Hebrew"
      , hi: "Hindi"
      , hu: "Hungarian"
      , id: "Indonesian"
      , it: "Italian"
      , ja: "Japanese"
      , ko: "Korean"
      , lv: "Latvian"
      , lt: "Lithuanian"
      , no: "Norwegian"
      , pl: "Polish"
      , pt: "Portuguese"
      , ro: "Romanian"
      , ru: "Russian"
      , sk: "Slovak"
      , sl: "Slovenian"
      , es: "Spanish"
      , sv: "Swedish"
      , th: "Thai"
      , tr: "Turkish"
      , uk: "Ukrainian"
      , vi: "Vietnamese"
      , "zh-CN": "Chinese Simplified"
      , "zh-TW": "Chinese Traditional"
      }
for (let [code, name] in Iterator(MS_LANGS_REV)) MS_LANGS[name] = code

function defaultLanguage(code2name, exclude) {
  for (let pref of [exclude ? PREF_LANG_ALT : PREF_LANG_DEFAULT,
                    "intl.accept_languages",
                    "general.useragent.locale"])
    for (let code of Utils.prefs.get(pref, "").split(",")) {
      if (!(code = code.trim())) continue
      code = (/^(..-)(..)$/i.test(code)
              ? RegExp.$1.toLowerCase() + RegExp.$2.toUpperCase()
              : code.slice(0, 2).toLowerCase())
      if (code === exclude) continue
      let name = code2name[code]
      if (name) return {name: name, code: code}
    }
  var fallback = exclude === "en" ? "ja" : "en"
  return {name: code2name[fallback], code: fallback}
}

function translate(target, from, to, back) {
  if (!to) return void
    msTranslator("Detect", {text: target.text}, function detected(code) {
      translate(target, from, defaultLanguage(MS_LANGS_REV, code).code, back)
    })
  var {html} = target
  // bitbucket#29: The API doesn't like apostrophes HTML-escaped.
  ~html.indexOf('<') || (html = html.replace(/&#39;/g, "'"))
  msTranslator("Translate", {
    contentType: "text/html", text: html, from: from, to: to,
  }, back)
}

function msTranslator(method, params, back) {
  params.appId = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"+ new Date % 10
  $.ajax({
    url: "http://api.microsofttranslator.com/V2/Ajax.svc/" + method,
    data: params,
    success : function mst_ok(json) { back(JSON.parse(json)) },
    error   : function mst_ng() {
      displayMessage({title: "Microsoft Translator", text: "(>_<)"})
    },
  })
}

CmdUtils.CreateCommand({
  name: "translate",
  description: "Translates from one language to another.",
  icon: "chrome://ubiquity/skin/icons/translate_bing.ico",
  help: '\
    You can specify the language to translate to,\
    and the language to translate from.\
    For example, try issuing "translate mother from english to chinese".\
    If you leave out the languages, it will try to guess what you want.\
    It works on selected text in any web page,\
    but there&#39;s a limit (a couple of paragraphs)\
    to how much it can translate a selection at once.\
    If you want to translate a lot of text, leave out the input and\
    it will load\
    <a href="http://www.microsofttranslator.com">Bing Translator</a> toolbar.\
  ',
  author: "satyr",
  arguments: ((noun) => ({
    object : noun_arb_text,
    source : noun,
    goal   : noun,
  }))(CmdUtils.NounType("language", MS_LANGS)),
  execute: function translate_execute({object, goal, source}) {
    var from = source.data || ""
      , to   = goal  .data
    if (object.text && object.text.length <= MS_TRANSLATOR_LIMIT)
      translate(object, from, to, CmdUtils.setSelection.bind(CmdUtils))
    else
      CmdUtils.injectJs(
        "http://labs.microsofttranslator.com/bookmarklet/default.aspx?f=js" +
        "&from=" + from +
        "&to=" + (to || defaultLanguage(MS_LANGS_REV).code))
  },
  preview: function translate_preview(pblock, {object, goal, source}) {
    var limitExceeded = object.text.length > MS_TRANSLATOR_LIMIT
    if (!object.text || limitExceeded) {
      let ph = _('\
        Loads <a href="http://www.microsofttranslator.com">Bing Translator</a>\
        toolbar.\
      ')
      if (limitExceeded)
        ph += '<p><em class="error">' +
          _("The text you selected exceeds the API limit.") +
        '</em>'
      pblock.innerHTML = ph
      return
    }
    var name = goal.text
      , phtml = _("Translates the selected text:")
    pblock.innerHTML = phtml + " ..."
    translate(
      object, source.data || "", goal.data,
      CmdUtils.previewCallback(pblock, function show(html) {
        pblock.innerHTML = phtml + "<br><br>" + html
      }))
  },
  _getUrl() { return noun_type_url.default()[0].text },
})

CmdUtils.CreateCommand({
  names: ["translate page", "Google Translate"],
  description: '\
    Translates a whole page to the specified language using\
    <a href="http://translate.google.com">Google Translate</a>.\
  ',
  icon: "chrome://ubiquity/skin/icons/translate_google.ico",
  author: "satyr",
  arguments: {
    object : noun_type_url,
    goal   : noun_type_lang_google,
  },
  execute: function gtranslate_execute({object, goal}) {
    Utils.openUrlInBrowser(
      "http://translate.google.com/translate" +
      Utils.paramsToString({
        u  : object.text,
        tl : goal.data ||
             defaultLanguage(noun_type_lang_google._code2name).code,
      }))
  },
  preview: function gtranslate_preview(pb, {object, goal}) {
    pb.innerHTML =
      _("Translates <code>${url}</code> to <strong>${language}</strong>.", {
        url      : Utils.escapeHtml(object.text),
        language : goal.text ||
                   defaultLanguage(noun_type_lang_google._code2name).name,
      })
  },
})

// -----------------------------------------------------------------
// COMMANDS THAT CREATE NEW COMMANDS
// -----------------------------------------------------------------

/* TODO: This command should take another optional argument to
 * provides an alternate name for the new command. */

/* TODO combine both of these into a single command with a provider
 * plugin?  i.e. "create command using/with/from bookmarklet",
 * "create command using/with/from search box"
 */
CmdUtils.CreateCommand({
  names: ["create bookmarklet command"],
  arguments: [{role: "source", nountype: noun_type_bookmarklet}],
  description: "Creates a new Ubiquity command from a bookmarklet.",
  help: ("For instance, if you have a bookmarklet called 'press this', " +
         "you can say 'create bookmarklet command from press this'."),
  author: {name: "Abimanyu Raja", email: "abimanyuraja@gmail.com"},
  license: "MPL",
  preview: function(previewBlock, {source: {text, data}}) {
    previewBlock.innerHTML =
      data
      ? 'Creates a new command called<b>'+ H(this._formatName(text)) +
        '</b> that runs the following bookmarklet:'+
        '<pre style="white-space:pre-wrap">'+ H(decodeURI(data)) +'</pre>'
      : this.description;
  },
  execute: function({source}) {
    var name = this._formatName(source.text);
    var url = source.data;

    //build the piece of code that creates the command
    var code =  [
      "// generated by " + this.name,
      "CmdUtils.makeBookmarkletCommand({",
      "  name: " + uneval(name) + ",",
      "  url: " + uneval(url) + ",",
      "});\n\n",
      ].join("\n");

    //prepend the code to Ubiqity's command editor
    CmdUtils.UserCode.prependCode(code);

    tellTheUserWeFinished(name, this);
  },
  _formatName(n) { return n.toLowerCase() },
});

CmdUtils.CreateCommand({
  names: ["create search command"],
  description: ("Creates a new Ubiquity command from a focused search-box " +
                "and lets you set the command name."),
  help: '<ol style="list-style-image:none">\
         <li>Select a searchbox.</li>\
         <li>Say "create search command mysearch".</li>\
         <li>Execute.</li>\
         <li>You now have a command called "mysearch".</li>\
         </ol>',
  author:
  {name: "Marcello Herreshoff", homepage: "http://stanford.edu/~marce110/"},
  contributors: ["Abimanyu Raja", "satyr"],
  icon: "chrome://ubiquity/skin/icons/search.png",
  license: "GPL/LGPL/MPL",
  homepage:
  "http://stanford.edu/~marce110/verbs/new-command-from-search-box.html",
  arguments: [{
    role: "object",
    nountype: noun_arb_text,
    label: "command name"}],
  preview: function csc_preview(pblock, {object: {html}}) {
    pblock.innerHTML = (
      html
      ? _("Creates a new search command called <b>${text}</b>", {text: html})
      : this.previewDefault());
  },
  execute: function csc_execute({object: {text: name}}) {
    var node = context.focusedElement || 0;
    var {form} = node;
    if (!node || !form) {
      displayMessage(
        _("You need to focus a searchbox before running this command."));
      return;
    }
    //1. Figure out what this searchbox does.
    const PLACEHOLDER = "{QUERY}";
    var formData = [];
    Array.forEach(form.elements, function(el) {
      if (!el.type) return; // happens with fieldsets
      if (el === node) {
        formData.push(this._encodePair(el.name, "") + PLACEHOLDER);
        return;
      }
      var type = el.type.toLowerCase();
      if (/^(?:text(?:area)?|hidden)$/.test(type) ||
          /^(?:checkbox|radio)$/.test(type) && el.checked)
        formData.push(this._encodePair(el.name, el.value));
      else if (/^select-(?:one|multiple)$/.test(type))
        Array.forEach(el.options, function(o) {
          if (o.selected)
            formData.push(this._encodePair(el.name, o.value));
        }, this);
    }, this);
    var doc = node.ownerDocument;
    var uri = Utils.url({uri: form.getAttribute("action"), base: doc.URL});
    var url = uri.spec;
    var data = formData.join("&");
    var post = form.method.toUpperCase() === "POST";
    if (!post) url += "?" + data;

    //2. Generate the name if not specified.
    if (!name) name = uri.host || doc.title;

    //3. Build the piece of code that creates the command
    var codes = [];
    codes.push(
      "// generated by " + this.name,
      "CmdUtils.makeSearchCommand({",
      "  name: " + uneval(name) + ",",
      "  url: " + uneval(url) + ",");
    doc.characterSet !== "UTF-8" && codes.push(
      "  charset: " + uneval(doc.characterSet) + ",");
    post && codes.push(
      "  postData: " + uneval(data) + ",");
    codes.push(
      "});\n\n");

    //4. Prepend the code to command-editor
    CmdUtils.UserCode.prependCode(codes.join("\n"));

    //5. Tell the user we finished
    tellTheUserWeFinished(name, this);
  },
  _encodePair(key, val) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(val)
  },
});

const MSG_CREATED = _("You have created the command: [ ${name} ]. " +
                      "You can edit its source-code with the command editor.");

function tellTheUserWeFinished(name, cmd) {
  displayMessage(CmdUtils.renderTemplate(MSG_CREATED, {name: name}),
                 cmd);
}
