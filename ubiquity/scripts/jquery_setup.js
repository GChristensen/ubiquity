// This sets up jQuery when it's loaded in a hidden chrome window
// that doesn't provide a user interface (e.g., a WebJsModule).

Components.utils.import("resource://ubiquity/modules/utils.js");

jQuery.ajaxSetup({
  beforeSend: function(xhr) {
    // set default referer fo ajax requests, because many content-provider
    // (like google) will block api-calls without a valid HTTP referer,
    // for example, see http://code.google.com/apis/errors
    xhr.setRequestHeader("referer", "chrome://ubiquity/")
  },
  xhr: function currentChromeXHR() {
    // This is a fix for #470. We're going to create the XHR object
    // from whatever current window the user's using, so that any UI
    // that needs to be brought up as a result of the XHR is shown
    // to the user, rather than being invisible and locking up the
    // application.
    return new Utils.currentChromeWindow.XMLHttpRequest;
  }
});

jQuery.error = function nativeError(msg) {
  throw Components.Exception(
    msg,
    Components.results.NS_ERROR_FAILURE,
    Components.stack.caller);
};

jQuery.parseJSON = JSON.parse;
