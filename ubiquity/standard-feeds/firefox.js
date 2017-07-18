// -----------------------------------------------------------------
// HELPER OBJECT FOR CLOSING WINDOWS
// -----------------------------------------------------------------

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");

var H = Utils.escapeHtml;

// -----------------------------------------------------------------
// WINDOW COMMANDS
// -----------------------------------------------------------------

function quit() {
  let ng = Cc["@mozilla.org/supports-PRBool;1"]
           .createInstance(Ci.nsISupportsPRBool)
  Services.obs.notifyObservers(ng, "quit-application-requested", this._mode)
  if (ng.data) {
    displayMessage("Cancelled!", this)
    return
  }
  let appStartup = Cc["@mozilla.org/toolkit/app-startup;1"]
                   .getService(Ci.nsIAppStartup)
  appStartup.quit(
    appStartup.eAttemptQuit |
    appStartup.eRestart * (this._mode == "restart"))
}

CmdUtils.CreateCommand({
  name: "exit Firefox",
  description: "Exits Firefox.",
  icon: "chrome://ubiquity/skin/icons/exit_stop.png",
  execute: quit,
  _mode: "shutdown",
});

CmdUtils.CreateCommand({
  name: "restart Firefox",
  description: "Restarts Firefox.",
  icon: "chrome://ubiquity/skin/icons/arrow_refresh.png",
  execute: quit,
  _mode: "restart",
});

// TODO: if last window is closed, we should offer to save session
CmdUtils.CreateCommand({
  names: ["close window"],
  description: "Closes current window.",
  icon: "chrome://ubiquity/skin/icons/delete.png",
  execute: function closewin_execute() { context.chromeWindow.close() },
});

CmdUtils.CreateCommand({
  names: ["fullscreen"],
  description: "Toggles fullscreen mode.",
  icon: "chrome://ubiquity/skin/icons/arrow_out.png",
  execute: function fullscreen_execute() {
    CmdUtils.getWindow().fullScreen ^= 1;
  }
});

// -----------------------------------------------------------------
// TAB COMMANDS
// -----------------------------------------------------------------

function tabPreview(msg) {
  const PlaceHolder = "%tab%";
  msg = _(msg + " " + PlaceHolder);
  return function tab_preview(pblock, {object: {html, data: tab}}) {
    pblock.innerHTML =
      tab
      ? '<div class="tab">' +
        msg.replace(PlaceHolder, html.bold()) +
        '<p><img src="' +
        H(CmdUtils.getTabSnapshot(tab, {width: 480})) +
        '"/></p></div>'
      : this.description;
  };
}

CmdUtils.CreateCommand({
  name: "switch to tab",
  argument: noun_type_tab,
  icon: "chrome://ubiquity/skin/icons/tab_go.png",
  description: "Switches to the tab whose title or URL matches the input.",
  execute: function swtab_execute({object: {data: tab}}) {
    if (tab) Utils.setTimeout(() => tab.focus(), 0);
  },
  preview: tabPreview("Changes to"),
});

CmdUtils.CreateCommand({
  name: "close tab",
  argument: noun_type_tab,
  icon: "chrome://ubiquity/skin/icons/tab_delete.png",
  description: ("Closes the tab whose title or URL matches the input " +
                "or the current tab if no tab matches."),
  execute: function cltab_execute(args) {
    (args.object.data || Utils.currentTab).close();
  },
  preview: tabPreview("Closes"),
});

CmdUtils.CreateCommand({
  names: ["close all tabs with"],
  arguments: [{
    role: "object",
    nountype: noun_arb_text,
    label: "related word"}],
  icon: "chrome://ubiquity/skin/icons/tab_delete.png",
  description: "Closes all open tabs that have the given word in common.",
  execute: function clatab_execute({object: {text}}) {
    if (!text) return;
    var tabs = Utils.tabs.search(text);
    for (var t of tabs) t.close();
    displayMessage(_("${num} tab(s) closed.", {num: tabs.length}), this);
  },
  preview: function clatab_preview(pblock, {object: {text, html}}) {
    if (!text) {
      this.previewDefault(pblock);
      return;
    }
    pblock.innerHTML = _(
      '<div class="close-all-tabs">\
       {if tabs.length}\
         Closes tabs related to <b>${html}</b> :\
         <ul>{for tab in tabs}${tab|asList}{/for}</ul>\
       {else}\
         No tabs are related to <b>${html}</b>.\
       {/if}\
       </div>\
      ',
      { tabs: Utils.tabs.search(text),
        html: html,
        _MODIFIERS: {asList: this._lister} });
  },
  _lister: function clatab__lister({document: d}) {
    return '<li>'+ H(d.title) +
           '<br/><code>'+ H(d.location.href) +'</code></li>'
  },
});

CmdUtils.CreateCommand({
  names: ["count tabs"],
  description: ("Counts the number of opened tabs. Takes an optional " +
                "filter term to count number of tabs matching filter term."),
  arguments: {object: noun_arb_text},
  icon: "chrome://ubiquity/skin/icons/tab_go.png",
  execute: function cntab_execute(args) {
    displayMessage($(this._count(args)).text(), this);
  },
  preview: function cntab_preview(pblock, args) {
    pblock.innerHTML = this._count(args);
  },
  _count: function cntab__count({object: {text, html}}) {
    var count = (text ? Utils.tabs.search(text) : Utils.tabs).length;
    return _('<div class="count-tabs"><b>${count}</b> ' +
             'tab{if count > 1}s{/if} ' +
             '{if html}matching <b>${html}</b>{else}total{/if}.</div>',
             {count: count, html: html});
  }
});

CmdUtils.CreateCommand({
  names: ["stop"],
  description: "Stops the current page.",
  icon: "chrome://ubiquity/skin/icons/stop.png",
  execute: function stop_execute() {
    CmdUtils.getWindow().stop();
  }
});

CmdUtils.CreateCommand({
  names: ["refresh", "reload"],
  description: "Refreshes the current page.",
  icon: "chrome://ubiquity/skin/icons/page_refresh.png",
  execute: function reload_execute() {
    CmdUtils.getWindow().location.reload(true);
  }
});

CmdUtils.CreateCommand({
  names: ["bookmark"],
  description: "Adds the current page to bookmarks.",
  icon: "chrome://ubiquity/skin/icons/folder_star.png",
  execute: function bookmark_execute() {
    const NBS = (Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                 .getService(Ci.nsINavBookmarksService));
    var {title, uri} = Utils.currentTab;
    try {
      NBS.insertBookmark(
        NBS.unfiledBookmarksFolder, uri, NBS.DEFAULT_INDEX, title);
    } catch (e) {
      displayMessage({
        text: _("Page could not be bookmarked!"),
        exception: e,
      }, this);
    }
  }
});

CmdUtils.CreateCommand({
  names: ["print"],
  description: "Prints the current page.",
  execute: function print_execute() {
    CmdUtils.getWindow().print();
  }
});

CmdUtils.CreateCommand({
  names: ["print preview"],
  description: "Shows the print preview of the current page.",
  execute: function pprint_execute() {
    context.chromeWindow.document
      .getElementById("cmd_printPreview").doCommand();
  }
});

// goes back/forward in history
(function historyCommand(way, sign) {
  var tmpl = _("Go " + way + " ${num} step{if num > 1}s{/if} in history.");
  CmdUtils.CreateCommand({
    names: ["go " + way],
    description: "Goes " + way + " in history.",
    icon: "chrome://browser/skin/menu-" + way + ".png",
    arguments: {object_steps: noun_type_number},
    preview: function go_preview(pblock, args) {
      pblock.innerHTML =
        CmdUtils.renderTemplate(tmpl, {num: args.object.data});
    },
    execute: function go_execute(args) {
      CmdUtils.getWindow().history.go(args.object.data * sign);
    }
  });
  return arguments.callee;
})("back", -1)("forward", 1);

CmdUtils.CreateCommand({
  names: ["go home"],
  description: "Goes to home page.",
  icon: "chrome://ubiquity/skin/icons/home_house.png",
  execute: function home_execute() {
    CmdUtils.getWindow().home();
  }
});

CmdUtils.CreateCommand({
  names: ["open error console"],
  description: "Opens Error Console.",
  icon: "chrome://global/skin/icons/error-16.png",
  execute: function errcon_execute() {
    var cwin = context.chromeWindow;
    (cwin.toErrorConsole || cwin.toJavaScriptConsole)(); // Console^2 or normal
  }
});

// -----------------------------------------------------------------
// ZOOM RELATED
// -----------------------------------------------------------------

CmdUtils.CreateCommand({
  names: ["zoom"],
  argument: noun_type_percentage,
  icon: "chrome://ubiquity/skin/icons/magnifier.png",
  description: "Zooms the current page in or out.",
  preview: function zoom_preview(pBlock, args) {
    pBlock.innerHTML = _(
      "Zooms the current page to ${text} of its normal size.",
      args.object);
  },
  execute: function zoom_execute(args) {
    var win = context.chromeWindow, ZM = win.ZoomManager;
    ZM.zoom = Math.max(ZM.MIN, Math.min(args.object.data, ZM.MAX));
    win.FullZoom._applySettingToPref();
  },
});

// -----------------------------------------------------------------
// TAGGING COMMANDS
// -----------------------------------------------------------------

CmdUtils.CreateCommand({
  names: ["tag"],
  description: "Adds tags to describe the current page.",
  help: "If the page is currently bookmarked, adds a tag or tags " +
        "(separated by spaces) to the current bookmark.  If the page " +
        "is not bookmarked, adds a bookmark to 'Unsorted bookmarks' and " +
        "also adds the tag or tags to that bookmark.",
  author: {
    name: "Dietrich Ayala",
    email: "dietrich@mozilla.com",
    homepage: "http://autonome.wordpress.com/"},
  license: "MPL/GPL/LGPL",
  icon: "chrome://ubiquity/skin/icons/folder_star.png",
  argument: noun_type_tag,
  preview: function tag_preview(aEl, args) {
    aEl.innerHTML = _(
      ("Describes the current page with" +
       "{if html} these tags:<p><b>${html}</b></p>{else} tags.{/if}"),
      args.object);
  },
  execute: function tag_execute({object: {text, data}}) {
    var doc = CmdUtils.getDocument();
    var {tagging, bookmarks} = PlacesUtils;
    var currentURI = doc.documentURIObject;

    if (!bookmarks.isBookmarked(currentURI)) {
      // create unfiled bookmark
      bookmarks.insertBookmark(bookmarks.unfiledBookmarksFolder, currentURI,
                               bookmarks.DEFAULT_INDEX, doc.title);
    }
    tagging.tagURI(currentURI, data);
  }
});

CmdUtils.CreateCommand({
  names: ["run bookmarklet", "bml"],
  description: "Runs a bookmarklet from your favorites.",
  help: "Enter nothing to reload the list.",
  author: {name: "satyr", email: "murky.satyr@gmail.com"},
  license: "MIT",
  icon: "chrome://ubiquity/skin/icons/script_lightning.png",
  argument: noun_type_bookmarklet,
  execute: function bml_execute({object}) {
    if (object.data) CmdUtils.getWindow().location = object.data;
    else {
      noun_type_bookmarklet.load();
      displayMessage("Reloaded", this);
    }
  },
  preview: function bml_preview(pbl, {object: {data}}) {
    pbl.innerHTML =
      data
      ? '<pre class="bookmarklet" style="white-space:pre-wrap">'+
        H(data) +'</pre>'
      : this.previewDefault();
  }
});

CmdUtils.CreateCommand({
  names: ["undo closed tabs", "uct"],
  description: "Reopens tabs you've closed recently.",
  help: '\
    <ul style="list-style-image:none">\
    <li>Use accesskey or click to undo.</li>\
    <li>Type to filter, then execute to undo all.</li>\
    </ul>',
  author: {name: "satyr", email: "murky.satyr@gmail.com"},
  contributor: {name: "powchin", homepage: "http://friendfeed.com/powchin"},
  license: "MIT",
  icon: "chrome://ubiquity/skin/icons/arrow_undo.png",
  arguments: {"object title or URL": noun_arb_text},
  execute: function uct_execute(args) {
    var ids = [for (tab of this._find(args.object.text)) tab.id];
    if (ids.length) this._undo(ids);
  },
  preview: function uct_preview(pbl, args) {
    var me = this;
    if (!me._SS.getClosedTabCount(context.chromeWindow)) {
      me._puts(pbl, _("No closed tabs."));
      return;
    }
    var tabs = me._find(args.object.text);
    if (!tabs.length) {
      me._puts(pbl, _("No matched tabs."));
      return;
    }
    CmdUtils.previewList(pbl, tabs.map(me._html), function uct__act(i, ev) {
      $(ev.target).closest("li").remove();
      me._undo([tabs[i].id]);
    }, me._css);
  },
  previewDelay: 256,
  _html: function uct__html({title, image, url}) {
    var html = '<span>'
    if (image) html += '<img class="icon" src="'+ H(image) +'"> '
    return html + H(title) +' <code class="url">'+
                  H(url) +'</code></span>'
  },
  _puts: function uct__puts(pbl, msg) {
    pbl.innerHTML = "<em>" + H(msg) + "</em>" + this.help;
  },
  _find: function uct__find(txt) {
    var tabs = JSON.parse(this._SS.getClosedTabData(context.chromeWindow))
    for (let tab of tabs)
      [{url: tab.url, ID: tab.id}] = tab.state.entries;
    if (txt) {
      var re = Utils.regexp(txt, "i");
      tabs = [for (t of tabs) if (re.test(t.title) || re.test(t.url)) t];
    }
    return tabs;
  },
  _undo: function uct__undo(ids) {
    var tabs = JSON.parse(this._SS.getClosedTabData(context.chromeWindow))
    for (let id of ids)
      for (let [i, t] in new Iterator(tabs)) {
        if (id !== t.state.entries[0].ID) continue;
        this._SS.undoCloseTab(context.chromeWindow, i);
        tabs.splice(i, 1);
        break;
      }
  },
  _css: "\
    li {white-space: nowrap}\
    .icon {width: 16px; height: 16px; vertical-align: middle}\
    .url {font-size: smaller}\
  ",
  _SS: (Cc["@mozilla.org/browser/sessionstore;1"]
        .getService(Ci.nsISessionStore)),
});

CmdUtils.CreateCommand({
  names: ["check livemark"],
  description: "Checks your livemarks.",
  help: "Execute to open the site.",
  author: {name: "satyr", email: "murky.satyr@gmail.com"},
  license: "MIT",
  icon: "chrome://browser/skin/page-livemarks.png",
  argument: noun_type_livemark,
  execute: function clm_execute({object: {data}}) {
    if (data) this._open(data.site);
  },
  preview: function clm_preview(pb, {object: {data}}) {
    if (!data) {
      this.previewDefault(pb);
      return;
    }
    var open = this._open;
    data.items(function (items) {
      var dict = {};
      for (var it of items)
        dict[it.uri] = '<span><a href="'+ H(it.uri) +'">'+
                       H(it.title) +'</a></span>';
      CmdUtils.previewList(pb, dict, open);
    });
  },
  _open: function clm__open(u) { Utils.openUrlInBrowser(u) },
});

CmdUtils.CreateCommand({
  names: ["view add-on", "view extension"],
  description: "Accesses extensions.",
  author: {name: "satyr", email: "murky.satyr@gmail.com"},
  license: "MIT",
  icon: "chrome://mozapps/skin/xpinstall/xpinstallItemGeneric.png",
  argument: noun_type_extension,
  execute: function ve_execute({object: {data}}) {
    Utils.setTimeout(this._open, 7, this, data && data.id);
  },
  preview: function ve_preview(pb, {object: {data}}) {
    if (!data) return void this.previewDefault(pb)
    var div = '<div class="extension'
    if (data.disabled) div += " disabled"
    div += '"><style>\
      .disabled {opacity:0.7}\
      .icon {float:left; vertical-align:top; border:none; margin-right:1ex}\
      .version {margin-left:1ex}\
      .creator {font-size: 88%}\
      .creator, .description {margin-top:0.5ex}\
      .action:not([accesskey]) {display:none}\
    </style></div>'
    var name = '<a class="homepage" accesskey="H"'
    if (data.homepageURL) name += ' href="'+ H(data.homepageURL) +'"'
    name += '><img class="icon" src="'+ H(data.iconURL || this.icon) +
            '"/><strong class="name">'+ H(data.name) +'</strong></a>'
    div += name + '<span class="version">'+ H(data.version) +'</span>'
    if (data.creator)
      div += '<div class="creator">'+ H(data.creator) +'</div>'
    if (data.description)
      div += '<div class="description">'+ H(data.description) +'</div>'
    div += '<p class="buttons">\
              <input type="button" class="action" id="options"/>\
              <input type="button" class="action" id="directory"/>\
            </p>'
    pb.innerHTML = div +'</div>'
    if (!data.disabled && data.optionsURL) {
      var opt = pb.ownerDocument.getElementById("options");
      opt.value = _("Options");
      opt.accessKey = "O";
      opt.addEventListener("click", function ve_options() {
        context.chromeWindow.openDialog(data.optionsURL, "", "");
        this.blur();
      }, false);
    }
    var file = Utils.DirectoryService.get("ProfD", Ci.nsIFile);
    try {
      file.append(data.id);
      file.append("extensions");
    } catch (e if e.result === Cr.NS_ERROR_FILE_UNRECOGNIZED_PATH) { return }
    if (file.exists() && file.isDirectory()) {
      var dir = pb.ownerDocument.getElementById("directory");
      dir.value = _("Directory");
      dir.accessKey = "D";
      dir.addEventListener("click", function ve_dir() {
        Utils.openUrlInBrowser(Utils.IOService.newFileURI(file).spec);
        this.blur();
      }, false);
    }
  },
  _open: function ve__open(self, id) {
    if(!id) return;
    var {window} = Utils.focusUrlInBrowser("about:addons");
    if (!window) return;
    var count = 0, maxTry = 16;
    !function toDetail() {
      if ("gViewController" in window)
        window.gViewController.loadView(
          "addons://detail/" + encodeURIComponent(id));
      else if (++count <= maxTry)
        Utils.setTimeout(toDetail, 99);
    }();
  },
});
