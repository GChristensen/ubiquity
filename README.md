# Ubiquity

Firefox Ubiquity Addon

See more at: https://wiki.mozilla.org/Labs/Ubiquity

[DOWNLOAD](ubiquity-0.6.5g.xpi?raw=true) :: [VIDEO MANUAL](https://youtu.be/9hXU1GAm_Qg)

This is a patched clone of the original repository by [satyr](http://profile.hatena.ne.jp/murky-satyr/) at: https://bitbucket.org/satyr/ubiquity 
(also available at [AMO](https://addons.mozilla.org/en-US/firefox/addon/mozilla-labs-ubiquity/)) primarily needed for ths repository owner's personal needs.

Enhancements in this patched version: 

* [subscribe locally](http://d.hatena.ne.jp/murky-satyr/20090308/subscribe_locally) command is added as a builtin one
* commands at the suggestion list are dedashed (but it seems that it's still necessary to type the dash at the command prompt since Ubiquity's 
current parser can't detect command names with spaces)

![](dedashed.png?raw=true)

This is an unsigned addon (it seems, that it will be possible to sign the future versions of ubiquity, if any, only by special request to Mozilla).
To use it you need to know how to [disable](https://wiki.mozilla.org/Add-ons/Extension_Signing#FAQ) extension signing (there is also a more harsh 
[option](https://github.com/5digits/dactyl/wiki/Disable-extension-signing-requirement-in-Firefox-49-or-later) that works for all Firefox versions).

You can find the original signed version at satyr's repository (or AMO).