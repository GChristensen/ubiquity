Cu.import("resource://ubiquity/modules/prefcommands.js");
Cu.import("resource://ubiquity/modules/localization_utils.js");

var L = LocalizationUtils.propertySelector(
  "chrome://ubiquity/locale/aboutubiquity.properties");

var editor;

var Editor = {
  onLoad: function () {
    editor = document.getElementById("editor");
    editor.value = PrefCommands.getCode();
    editor.addEventListener("input", function updateCode() {
      PrefCommands.setCode(this.value);
    });
    editor.focus();
  },
  readFile: function (file) {
    var fstream = (Cc["@mozilla.org/network/file-input-stream;1"]
                   .createInstance(Ci.nsIFileInputStream));
    var sstream = (Cc["@mozilla.org/scriptableinputstream;1"]
                   .createInstance(Ci.nsIScriptableInputStream));
    fstream.init(file, -1, 0, 0);
    sstream.init(fstream);

    var value = "";
    var str = sstream.read(4096);
    while (str) {
      value += str;
      str = sstream.read(4096);
    }

    sstream.close();
    fstream.close();
    return value;
  }
}

function paste() {
  try {
    var code = editor.value;
    pasteToGist("x", code, /^\s*</.test(code) ? "xhtml" : "js");
  } catch (e) {
    Cu.reportError(e);
    displayMessage(e);
  }
}

function importTemplate() {
  var code = Utils.getLocalUrl("chrome://ubiquity/content/command-template.js")
           + editor.value;
  PrefCommands.setCode(code);
  editor.value = code;
  editor.focus();
}

function saveAs() {
  try {
    const {nsIFilePicker} = Ci;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, L("ubiquity.editor.savecommands"), nsIFilePicker.modeSave);
    fp.appendFilter("JavaScript", "*.js");
    if (fp.show() == nsIFilePicker.returnCancel) return;

    saveTextToFile(editor.value, fp.file);
    UbiquitySetup.createServices().feedManager.addSubscribedFeed({
      title: fp.file.leafName,
      sourceUrl: fp.fileURL.spec,
      canAutoUpdate: true,
    });
    PrefCommands.setCode("");
    editor.value = "";
    $("#editor-log").html(
      "<p>" + L("ubiquity.editor.savelogmsgp1",
                "<strong>" + H(fp.file.path) + "</strong>") + "</p>" +
      "<p>" + L("ubiquity.editor.savelogmsgp2") + "</p>");
  } catch (e) {
    Cu.reportError(e);
    displayMessage(e);
  }
}

function saveTextToFile(text, file) {
  var foStream = (Cc["@mozilla.org/network/file-output-stream;1"]
                  .createInstance(Ci.nsIFileOutputStream));
  // write, create, truncate; r+W for owner, read-only for everybody else
  foStream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);

  var os = (Cc["@mozilla.org/intl/converter-output-stream;1"]
            .createInstance(Ci.nsIConverterOutputStream));
  os.init(foStream, "UTF-8", 0, 0x0000);

  os.writeString(text);
  os.close();

  foStream.close();
}

function displayMessage(msg) {
  $("#notification-bar").hide().text(msg).show("fast");
}

this.onload = Editor.onLoad.bind(Editor);
