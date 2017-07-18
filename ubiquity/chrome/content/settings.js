/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blair McBride <unfocused@gmail.com>
 *   Abimanyu Raja <abimanyuraja@gmail.com>
 *   Satoshi Murakami <murky.satyr@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Cu.import("resource://ubiquity/modules/cmdmanager.js");
Cu.import("resource://ubiquity/modules/prefkeys.js")
Cu.import("resource://ubiquity/modules/parser.js");

var {skinService, messageService} = UbiquitySetup.createServices();

$(onDocumentLoad);

function onDocumentLoad() {
  loadSkinList();

  var $langSelect = $("#language-select");
  var {languageCode} = UbiquitySetup;
  for (let code in ParserRegistry) {
    let $opt = $("<option>", {val: code, text: ParserRegistry[code].name});
    $opt[0].selected = code == languageCode;
    $langSelect.append($opt);
  }

  $("#max-suggestions").change(function changeMaxSuggestions() {
    CommandManager.maxSuggestions = this.value;
    this.value = CommandManager.maxSuggestions;
  }).val(CommandManager.maxSuggestions);

  new PrefKeys().registerUI($("#keyInput")[0], $("#keyNotify")[0]);
  new PrefKeys("repeat").registerUI($("#repeatKeyInput")[0], {});
}

function changeLanguageSettings() {
  UbiquitySetup.languageCode = $("#language-select").val()
}

function loadSkinList() {
  var {skins, currentSkin} = skinService;
  var $list = $("#skin-list").empty(), id = -1;
  for (let skin of Utils.sort(skins, s => s.uri.spec))
    $list.append(createSkinElement(skin, ++id, skin === currentSkin));
  if (currentSkin === skinService.customSkin) openSkinEditor();
}

function createSkinElement(skin, id, current) {
  var {metaData} = skin;
  var $skin = $(
    '<div class="command light" id="skin_' + id + '">' +
    ('<input type="radio" name="skins" id="rad_skin_' + id + '"' +
     (current ? ' checked="checked"' : '') + '/>') +
    '<label class="label" for="rad_skin_'+ id +
    '"><a class="name"/></label></div>');

  $skin.find(".name").text(metaData.name);
  $skin.find("input").change(function onPick() { skin.pick() });

  "author" in metaData && $("<div>", {
    class: "author",
    text: L("ubiquity.settings.skinauthor", metaData.author),
  }).appendTo($skin);
  "license" in metaData && $("<div>", {
    class: "license",
    text: L("ubiquity.settings.skinlicense", metaData.license),
  }).appendTo($skin);
  if ("email" in metaData) {
    let ee = H(metaData.email)
    $("<div>", {
      class : "email",
      html  : "email: " + ee.link("mailto:" + ee),
    }).appendTo($skin)
  }
  if ("homepage" in metaData) {
    let eh = H(metaData.homepage)
    $("<div>", {
      class : "homepage",
      html  :  eh.link(eh),
    }).appendTo($skin)
  }

  ($('<a class="action" target="_blank"></a>')
   .attr("href", "view-source:" + skin.viewSourceUri.spec)
   .text(L("ubiquity.settings.viewskinsource"))
   .appendTo($skin));

  skin.isBuiltIn || (
    $('<a class="action"></a>')
    .text(L("ubiquity.settings.uninstallskin"))
    .click(function uninstall() {
      if (skin === skinService.currentSkin) skinService.defaultSkin.pick();
      skin.purge();
      $skin.slideUp();
    })
    .appendTo($skin.append(" ")));

  return $skin;
}

function openSkinEditor() {
  $("#editor-div").show();
  $("#skin-editor").val(skinService.customSkin.css).focus();
  $("#edit-button").hide();
}

function saveCustomSkin() {
  var {customSkin} = skinService;
  customSkin.css = $("#skin-editor").val();
  messageService.displayMessage(L("ubiquity.settings.skinsaved"));
  if (customSkin === skinService.currentSkin) customSkin.pick();
}

function saveAs() {
  try {
    skinService.saveAs($("#skin-editor").val(), "custom.css");
  } catch (e) {
    messageService.displayMessage(L("ubiquity.settings.skinerror"));
    Cu.reportError(e);
    return;
  }
  loadSkinList();
}

function shareSkin() {
  var data = $("#skin-editor").val()
  var name = ((/@name[ \t]+(.+)/.exec(data) || [, "ubiquity-skin"])[1]).trim();
  pasteToGist(name, data, "css");
}
