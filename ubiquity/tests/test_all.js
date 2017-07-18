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
 *   Atul Varma <atul@mozilla.com>
 *   Jono DiCarlo <jdicarlo@mozilla.com>
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

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://ubiquity/modules/utils.js");
Cu.import("resource://ubiquity/modules/nounutils.js");
Cu.import("resource://ubiquity/modules/sandboxfactory.js");
Cu.import("resource://ubiquity/modules/codesource.js");
Cu.import("resource://ubiquity/modules/parser.js");
Cu.import("resource://ubiquity/modules/feedmanager.js");
Cu.import("resource://ubiquity/modules/cmdmanager.js");
Cu.import("resource://ubiquity/modules/localization_utils.js");

Cu.import("resource://ubiquity/tests/framework.js");
Cu.import("resource://ubiquity/tests/test_eventhub.js");
Cu.import("resource://ubiquity/tests/test_suggestion_memory.js");
Cu.import("resource://ubiquity/tests/test_annotation_memory.js");
Cu.import("resource://ubiquity/tests/test_hiddenbrowser.js");
Cu.import("resource://ubiquity/tests/test_parser.js");
Cu.import("resource://ubiquity/tests/testing_stubs.js");

var globalObj = this;

function testXhtmlCodeSourceWorks() {
  var code = "function cmd_foo() {};";
  var xhtml = '<html xmlns="http://www.w3.org/1999/xhtml"><script>a = 1;</script><script class="commands">' + code + '</script></html>';
  var fakeSource = {
    id: "blah",
    updated: true,
    getCode: function() { return xhtml; },
  };

  var xcs = new XhtmlCodeSource(fakeSource);

  this.assert(xcs.id == "blah", "id must inherit");
  var xcsCode = xcs.getCode();
  this.assert(xcsCode == code,
              "code must be '" + code + "' (is '" + xcsCode + "')");
  this.assert(xcs.dom, "xcs.dom must be truthy.");
  this.assertEquals(xcs.getCode(), xcsCode);
}

function testUtilsUrlWorksWithNsURI() {
  var ios = Cc["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
  var uri = ios.newURI("http://www.foo.com", null, null);

  this.assert(Utils.url(uri).spec == "http://www.foo.com/");
}

function testUtilsUrlWorksWithString() {
  this.assert(Utils.url("http://www.foo.com").spec == "http://www.foo.com/");
}

function testUtilsUrlWorksWithKeywordArgs() {
  var kwargs = {
    base: "http://www.foo.com",
    uri: "bar/baz.txt"
  };
  var expected = "http://www.foo.com/bar/baz.txt";

  this.assert(Utils.url(kwargs).spec == expected);

  kwargs.base = Utils.url(kwargs.base);
  this.assert(Utils.url(kwargs).spec == expected);
}

function testMixedCodeSourceWorks() {
  let a = new StringCodeSource("a", "a");
  let b = new StringCodeSource("b", "b");
  let c = new StringCodeSource("c", "c");
  let d = new StringCodeSource("d", "d");
  let e = new StringCodeSource("e", "e");
  let f = new StringCodeSource("f", "f");

  let headers = [a, b];
  let footers = [e, f];

  let codeSources = [
    new MixedCodeSource(c, headers, footers),
    new MixedCodeSource(d, headers, footers)
  ];

  this.assertEquals(codeSources[0].getCode(), "abcef");
  this.assertEquals(codeSources[0].id, "c");
  this.assertEquals(codeSources[0].codeSections[1].filename, "b");
  this.assertEquals(codeSources[0].codeSections[1].length, 1);

  this.assertEquals(codeSources[1].getCode(), "abdef");
  this.assertEquals(codeSources[1].id, "d");
  this.assertEquals(codeSources[1].codeSections[2].filename, "d");
  this.assertEquals(codeSources[1].codeSections[2].length, 1);
}

function testFeedManagerWorks() {
  var FMgr = new FeedManager(new TestAnnotationMemory(this));
  var fakeFeedPlugin = {
    type: "fake",
    makeFeed(baseFeedInfo, hub) { return {
      __proto__: baseFeedInfo,
      refresh: function refresh() {
        this.commandNames = [];
        this.commands = [];
        this.pageLoadFuncs = [];
        this.ubiquityLoadFuncs = [];
      },
    } },
  };

  FMgr.registerPlugin(fakeFeedPlugin);

  var url = "http://www.foo.com";
  var sourceUrl = "http://www.foo.com/code.js";
  var code = "function blah() {}";

  this.assert(!FMgr.isSubscribedFeed(sourceUrl));
  FMgr.addSubscribedFeed({
    url: url,
    sourceUrl: sourceUrl,
    sourceCode: code,
    canAutoUpdate: false,
    type: "fake",
    isBuiltIn: true,
  });
  this.assert(!FMgr.isSubscribedFeed(url));
  this.assert(FMgr.isSubscribedFeed(sourceUrl));

  var results = FMgr.getSubscribedFeeds();

  this.assertEquals(results.length, 1);

  // Ensure the result is what we think it is.
  var feed = results[0];
  this.assertEquals(feed.getCode(), code);

  // Add another subscribed feed and make sure things still make sense.
  var moreCode = "function narg() {}";
  FMgr.addSubscribedFeed({
    url: "http://www.bar.com",
    sourceUrl: "http://www.bar.com/code.js",
    sourceCode: moreCode,
    canAutoUpdate: false,
    type: "fake"});
  results = FMgr.getSubscribedFeeds();

  this.assertEquals(results[0].getCode(), code);
  this.assertEquals(results[1].getCode(), moreCode);

  var newCode = "// new code";
  results[0].setCode(newCode);
  this.assertEquals(results[0].getCode(), newCode);

  // TODO: Iterate through the collection and ensure that it behaves
  // how we think it should.

  results[0].remove();
  this.assert(!FMgr.isSubscribedFeed(sourceUrl));
  this.assert(FMgr.isUnsubscribedFeed(sourceUrl));

  results[0].unremove();
  this.assert(FMgr.isSubscribedFeed(sourceUrl));
  this.assert(!FMgr.isUnsubscribedFeed(sourceUrl));

  results[0].purge();
  this.assertEquals(FMgr.getFeedForUrl(sourceUrl), null);
}

function getNounList() {
  return [];
}

function testCmdManagerExecutesTwoCmds() {
  var mockMsgService = {
    displayMessage: function(msg) {}
  };
  var oneWasCalled = false;
  var twoWasCalled = false;
  var pblock = {};

  var fakeSource = new FakeCommandSource(
    {
      cmd_one: {execute:function() {oneWasCalled = true;}},
      cmd_two: {execute:function() {twoWasCalled = true;}}
    });

  makeCommandManager.call(this, fakeSource, mockMsgService,
                          makeTestParser(), onCM);
  function onCM(cmdMan){
    var fakeContext = {focusedElement: null,
                       focusedWindow: null};

    cmdMan.updateInput("cmd_one", fakeContext);
    this.assert(cmdMan.__activeQuery.suggestionList.length == 1, "should have 1");
    cmdMan.execute(fakeContext);
    cmdMan.updateInput("cmd_two", fakeContext);
    this.assert(cmdMan.__activeQuery.suggestionList.length == 1, "should have 1");
    cmdMan.execute(fakeContext);
    this.assert(oneWasCalled, "cmd_one must be called.");
    this.assert(twoWasCalled, "cmd_two must be called.");
  }
}

function testCmdManagerExecutesCmd() {
  var mockMsgService = {
    displayMessage: function(msg) {}
  };
  var wasCalled = false;

  var fakeSource = new FakeCommandSource ({
    existentcommand:{execute:function() {wasCalled = true;}}
  });
  var fakeContext = {focusedElement: null,
                     focusedWindow: null};

  makeCommandManager.call(this, fakeSource, mockMsgService,
                          makeTestParser(), onCM);
  function onCM(cmdMan) {
    cmdMan.updateInput("existentcommand", fakeContext);
    cmdMan.execute(fakeContext);
    this.assert(wasCalled, "command.execute() must be called.");
  }
}

function testCmdManagerCatchesExceptionsInCmds() {
  var mockMsgService = {
    displayMessage: function (msg) { this.lastMsg = msg; }
  };
  var fakeSource = new FakeCommandSource({
    existentcommand: {execute: function () { throw 1 }}
  });
  var fakeContext = {focusedElement: null, focusedWindow: null};

  makeCommandManager.call(this, fakeSource, mockMsgService,
                          makeTestParser(), onCM);
  function onCM(cmdMan) {
    cmdMan.updateInput("existentcommand", fakeContext);
    cmdMan.execute(fakeContext);
    this.assert(
      (mockMsgService.lastMsg || 0).exception,
      "Command manager must log exception.");
  }
}

function testUtilsSort() {
  var strArray = ["abc", "d", "ef", "ghij", "klm", "nop", "qrstuvw", "xyz"];
  this.assertEquals(strArray.slice().sort() + "",
                    Utils.sort(strArray.slice()) + "");
  this.assertEquals(strArray.slice().sort().reverse() + "",
                    Utils.sort(strArray.slice(), String, true) + "");
  this.assertEquals(
    strArray.slice().sort((a, b) => a.length - b.length) + "",
    Utils.sort(strArray.slice(), "length") + "");
  // (-2|-1|0|1|2) x 99
  var numArray = [for (i of Utils.seq(99)) (Math.random() * 5 | 0) - 2];
  this.assertEquals(numArray.slice().sort((a, b) => b - a) + "",
                    Utils.sort(numArray, x => -x) + "");
}

function testUtilsUniq() {
  var ones = [1, "+1", ["1e0"], true];
  this.assertEquals(uneval(Utils.uniq(ones.slice())),
                    uneval(ones));
  this.assertEquals(uneval(Utils.uniq(ones, Number)),
                    "[1]");
  var objs = [{}, {}, {}];
  this.assertEquals(uneval(Utils.uniq(objs.slice())),
                    "[{}]");
  this.assertEquals(uneval(Utils.uniq(objs, null, true)),
                    uneval(objs));
}

function testUtilsComputeCryptoHash() {
  var str = "hello world";
  this.assertEquals(Utils.computeCryptoHash("md5", str),
                    "5eb63bbbe01eeed093cb22bb8f5acdc3");
  this.assertEquals(Utils.computeCryptoHash("sha1", str),
                    "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
}

function testUtilsParamsToString() {
  var data = {};
  var expected = "?";
  this.assertEquals(Utils.paramsToString(data), expected);

  data = {hello: "world"};
  expected = "?hello=world";
  this.assertEquals(Utils.paramsToString(data), expected);

  data = {
    hello: "world",
    life: 42
  };
  expected = "?hello=world&life=42";
  this.assertEquals(Utils.paramsToString(data), expected);

  data = {
    multiple: ["one", "two", "three"]
  };
  expected = "?multiple=one&multiple=two&multiple=three";
  this.assertEquals(Utils.paramsToString(data), expected);

  data = {
    obj: {
      value: "hello_world",
      toString: function() { return this.value; }
    }
  };
  expected = "?obj=hello_world";
  this.assertEquals(Utils.paramsToString(data), expected);
  this.assertEquals(Utils.paramsToString(data, ""), expected.slice(1));
}

function testUtilsUrlToParams() {
  this.assertEquals(
    uneval(Utils.urlToParams("foo=bar")),
    uneval({foo: "bar"}));
  this.assertEquals(
    uneval(Utils.urlToParams("http://foo.com/?bar=baz#quux")),
    uneval({bar: "baz"}));
  this.assertEquals(
    uneval(Utils.urlToParams("?dup=1&dup=2&%3F%26%3D%23=%E6%84%9B=+")),
    uneval({dup: ["1", "2"], "?&=#": "\u611B= "}));
}

function testUtilsIsArray() {
  this.assert(Utils.isArray([]));
  this.assert(!Utils.isArray({length: 0}));
}

function testXmlScriptCommandsParser() {
  Cu.import("resource://ubiquity/modules/xml_script_commands_parser.js");
  var code = parseCodeFromXml(
    '<foo>\n<script class="commands">' +
    '<![CDATA[testing\n\n\n>]]>' +
    '</script></foo>');
  this.assertEquals(code.length, 1);
  this.assertEquals(code[0].lineNumber, 2);
  this.assertEquals(code[0].code, "testing\n\n\n>");
}

function testLocalUriCodeSourceWorksWithBadFilenames() {
  var urls = ["chrome://truly-nonexistent",
              "file:///truly-nonexistent",
              "resource://truly-nonexistent",
              "ubiquity:///truly-nonexistent"];
  urls.forEach(function(url) {
    this.assertEquals(new LocalUriCodeSource(url).getCode(true), "");
  }, this);
}

function testUtilsGetLocalUrlWorks() {
  var json = Utils.getLocalUrl("resource://ubiquity/tests/test_all.json",
                               "utf-8");
  this.assert(JSON.parse(json) === "\u3053", json);
}

function testUtilsSetTimeoutWorks() {
  let self = this;
  let foo = "foo";
  let zoo = "zoo";
  Utils.setTimeout(self.makeCallback(function _foo(x, y) {
    foo = null;
    self.assertEquals(x, "bar");
    self.assertEquals(y, "baz");
    self.assertEquals(zoo, "zoo");
  }), 42, "bar", "baz");
  Utils.clearTimeout(Utils.setTimeout(function _zoo() { zoo = null }));
  self.assertEquals(foo, "foo");
}

function testNounType() {
  var {NounType} = NounUtils;
  var nounWords = new NounType("words", ["foo", "bar", "buz"]);
  this.assertEquals(nounWords.label, "words");
  this.assertEquals([for (s of nounWords.suggest("b")) s.text] + "",
                    "bar,buz");
  this.assertEquals(nounWords.id, NounType(["foo", "bar", "buz"]).id);

  var nounRegex = NounType(/(.)_(.)/, ["foo_bar"]);
  this.assertEquals(nounRegex.default[0].data + "", "o_b,o,b");

  var nounDict = NounType({
    foooo: 123,
    barrr: 456,
    buzzz: 789,
  }, "o r z");
  this.assertEquals([for (s of nounDict.default) s.data] + "",
                    "123,456,789");
}

function testUtilsRegexp() {
  var re = /:/;
  this.assertEquals(Utils.regexp(re, "y"), re),
  this.assertEquals(uneval(Utils.regexp("[")),
                    uneval(/\[/));
  this.assertEquals(Utils.regexp.quote("[^.^]"),
                    "\\[\\^\\.\\^]");
  var words = ["foobar", "fooxar", "foozap", "fooza"]
  var re = Utils.regexp.Trie(words).toRegExp();
  for (let word of words) this.assert(re.test(word), [re, word]);
  var rp = Utils.regexp.Trie(words, true).toRegExp(), i = 0;
  for (let word of words) {
    let wp = word.slice(0, --i);
    this.assert(rp.test(wp), [rp, wp]);
  }
}

function testUtilsIsEmpty() {
  var {assert} = this, {isEmpty} = Utils;
  assert(isEmpty(""));
  assert(isEmpty([]));
  assert(isEmpty({__proto__: [1]}));
  assert(!isEmpty([1]));
  assert(!isEmpty(Utils));
}

function testUtilsPowerSet() {
  var {assertEquals} = this, {powerSet} = Utils, a = [], b = {};
  assertEquals(
    uneval(powerSet([0,1,2])),
    uneval([[], [0], [1], [0,1], [2], [0,2], [1,2], [0,1,2]]));
  assertEquals(
    uneval(powerSet("ab")),
    uneval([[], ["a"], ["b"], ["a","b"]]));
  assertEquals(
    uneval(powerSet([a,b])),
    uneval([[], [a], [b], [a,b]]));
}

function testUtilsSeq() {
  var {assertEquals, assert} = this, {seq} = Utils;
  assertEquals(
    uneval([for (i of seq(1, 3)) i]),
    uneval([1, 2, 3]));
  assertEquals(
    uneval([for (i of seq(3)) i]),
    uneval([0, 1, 2]));
  assertEquals(
    uneval([for (i of seq(4, 2, -1)) i]),
    uneval([4, 3, 2]));
  assertEquals(
    uneval([...seq(-7)].slice(2, -2)),
    uneval([4, 3, 2]));
  for (let i of seq(0)) assert(false);
  for (let i of seq( )) assert(false);
  for (let i of seq(1,0,1)) assert(false);
}

function testUtilsListenOnce() {
  this.skipIfXPCShell();

  var {assertEquals} = this;
  var {document} = Utils.currentChromeWindow;
  var i = 0, type = "foo";
  function listener1(ev) {
    assertEquals(ev.type, type);
    assertEquals(ev.target, this);
    assertEquals(document,  this);
    ++i;
  }
  var listener2 = {handleEvent: function handler(ev) {
    assertEquals(ev.type, type);
    assertEquals(this.handleEvent, handler);
    ++i;
  }};
  Utils.listenOnce(document, type, listener1);
  Utils.listenOnce(document, type, listener2, true);
  for (let j = 0; j < 2; ++j) {
    let event = document.createEvent("Event");
    event.initEvent(type, false, false);
    document.dispatchEvent(event);
  }
  assertEquals(i, 2);
}

function testUtilsExtend() {
  var target = {prop: 0, get getter() {return 0}, set setter(x) {return 0}};
  var obj1 = {prop: "prop", get getter() {return "getter"}};
  var obj2 = {set setter(v) {this.prop = v}};
  this.assertEquals(target, Utils.extend(target, obj1, obj2));
  this.assertEquals(target.prop, "prop");
  this.assertEquals(target.getter, "getter");
  this.assertEquals(target.setter = 42, target.prop);
}

function testUtilsPrefs() {
  this.skipIfXPCShell();

  var {prefs} = Utils;
  var p = "extensions.ubiquity.test";
  this.assertEquals(prefs.get(p, p), p);
  this.assert(!prefs.reset(p));
  for (let v of ["\u2713", true, 42]) {
    prefs.set(p, v);
    this.assertEquals(prefs.get(p), v);
    this.assert(prefs.reset(p));
  }
  prefs.set(p + 1, 0);
  prefs.set(p + 2, 0);
  this.assertEquals(uneval(prefs.resetBranch(p).sort()),
                    uneval([p + 1, p + 2]));
}

function testUtilsEscapeUnescapeHtml() {
  this.skipIfXPCShell();

  var {escapeHtml, unescapeHtml} = Utils;
  var html = Utils.hiddenWindow.document.documentElement.innerHTML;
  this.assertEquals(
    html += " \n &spades; '\r &#x2665;&#9827;  \t",
    unescapeHtml(unescapeHtml(escapeHtml(escapeHtml(html)))));
}

function testUtilsEllipsify() {
  this.skipIfXPCShell();

  this.assertEquals(Utils.ellipsify("12345", 4, "\u2026"), "123\u2026");
  this.assertEquals(Utils.ellipsify("just an ellipsis", 1, "..."), "...");
  this.assertEquals(Utils.ellipsify("nothing to ellipsify", 0), "");

  var doc = Utils.hiddenWindow.document;
  var text = doc.createTextNode("text node");
  var comment = doc.createComment("comment node");
  var div = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  this.assertEquals(Utils.ellipsify(text, 2, ".").nodeValue, "t.");
  this.assertEquals(Utils.ellipsify(comment, 2, ".").nodeValue,
                    comment.nodeValue);
  div.appendChild(comment);
  div.appendChild(text);
  this.assertEquals(Utils.ellipsify(div, 5, ".").textContent, "text.");
  for (let i = 2; i --> 0;) div.appendChild(div.cloneNode(true));
  for (let i = div.textContent.length + 1; i --> 0; i -= 9) {
    let {length} = Utils.ellipsify(div, i, ".").textContent;
    this.assert(length <= i, length + " <= " + i);
  }
}

function testL10nUtilsPropertySelector() {
  var ps = LocalizationUtils.propertySelector(
    "data:," + encodeURI("\n  foo=%S %S\n  colon:works too\n"));
  this.assertEquals(ps("foo", "bar", "baz"), "bar baz");
  this.assertEquals(ps("colon"), "works too");
}

exportTests(this);
