CmdUtils.CreateCommand({
  name: 'subscribe locally',
  icon: 'chrome://ubiquity/skin/icons/favicon.ico',
  description: 'Directly subscribes to local command/skin feeds.',
  help: ('Execute to open the file picker. '+
         'You can select multiple files with it.'),
  homepage: 'http://d.hatena.ne.jp/murky-satyr/20090308/subscribe_locally',
  author: 'satyr', license: 'MIT',
  execute: function sl_execute(){
    const {nsIFilePicker, nsIFile} = Ci;
    var fp = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
    fp.init(context.chromeWindow, this.name, nsIFilePicker.modeOpenMultiple);
    fp.appendFilter('JS/XHTML/CSS', '*.js;*.xhtml;*.css');
    fp.appendFilter('*', '*');
    if(fp.show() !== nsIFilePicker.returnOK) return;
    var {files} = fp;
    var {feedManager} = (
      Cu.import('resource://ubiquity/modules/setup.js', null)
      .UbiquitySetup.createServices());
    var {getURLSpecFromFile} = (
      Utils.IOService.getProtocolHandler('file')
      .QueryInterface(Ci.nsIFileProtocolHandler));
    var paths = [], css = /\.css$/i;
    while(files.hasMoreElements()){
      let file = files.getNext().QueryInterface(nsIFile);
      let url = getURLSpecFromFile(file);
      feedManager.addSubscribedFeed({
        type: css.test(file.leafName) ? 'ubiquity-skin' : 'commands',
        url: url, sourceUrl: url,
        canAutoUpdate: true,
        title: file.leafName,
      });
      paths.push(file.path);
    }
    displayMessage('Subscribed to: '+ paths.join(', '), this);
    Utils.tabs.reload(/^about:ubiquity\?(?:cmdlist|settings)\b/);
  },
});