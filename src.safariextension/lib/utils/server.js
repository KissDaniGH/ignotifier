var isFirefox = typeof require !== 'undefined';
if (isFirefox) {
  app = require('../wrapper/firefox/app');
  config = require('../config');
  server = exports;
}
else {
  var server = {};
}

//
server.Parser = function(req, feed) {
  var xml;
  if (req.responseXML) {
    xml = req.responseXML;
  }
  else {
    if (!req.responseText) return;
    xml = app.parser().parseFromString(req.responseText, "text/xml");
  }
  //Sometimes id is wrong in the feed structure!
  function fixID (link) {
    var id = /u\/\d/.exec(feed);
    if (id.length) {
      return link.replace(/u\/\d/, id[0]);
    };
    return link;
  }
  return {
    get fullcount () {
      var temp = 0;
      var tags = xml.getElementsByTagName("fullcount");
      var entries = xml.getElementsByTagName("entry");
      try {
        var temp = (tags && tags.length) ? parseInt(tags[0].textContent) : 0;
        temp = Math.max(temp, (entries && entries.length) ? entries.length : 0);
      } catch(e) {}
      return temp;
    },
    get title () {
      var temp = "";
      try {
        temp = xml.getElementsByTagName("title")[0].childNodes[0].nodeValue;
        temp = temp.match(/[^ ]+@.+\.[^ ]+/)[0];
      } catch(e) {}
      return temp;
    },
    get label () {
      var label = "";
      try {
        var tagline = xml.getElementsByTagName("tagline")[0].childNodes[0].nodeValue;
        if (tagline) {
          var match = tagline.match(/\'(.*)\' label/);
          if (match.length == 2) {
            label = match[1];
          }
        }
      } catch(e) {}
      return label;
    },
    get link () {
      var temp = config.email.url,
          label;
      try {
        //Inbox href
        temp = xml.getElementsByTagName("link")[0].getAttribute("href").replace("http://", "https://");
        temp = fixID (temp);
        label = this.label;
        if (label) {
          temp += "/?shva=1#label/" + label;
        }
      } catch(e) {}

      return temp;
    },
    get rootLink () {
      var temp = config.email.url,
          label;
      try {
        //Inbox href
        temp = xml.getElementsByTagName("link")[0].getAttribute("href").replace("http://", "https://");
        temp = fixID (temp);
      } catch(e) {}

      return temp;
    },
    get authorized () {
      var temp = "";
      try {
        temp = xml.getElementsByTagName("TITLE")[0].childNodes[0].nodeValue;
      } catch(e){}
      return temp;
    },
    get entries () {
      var tmp = Array.prototype.slice.call( xml.getElementsByTagName("entry") );
      function toObj (entry) {
        return {
          get title () {
            return entry.getElementsByTagName("title")[0].textContent;
          },
          get summary () {
            return entry.getElementsByTagName("summary")[0].textContent;
          },
          get modified () {
            return entry.getElementsByTagName("modified")[0].textContent;
          },
          get issued () {
            return entry.getElementsByTagName("issued")[0].textContent;
          },
          get author_name () {
            return entry.getElementsByTagName("author")[0]
              .getElementsByTagName("name")[0].textContent;
          },
          get author_email () {
            return entry.getElementsByTagName("author")[0]
              .getElementsByTagName("email")[0].textContent;
          },
          get id () {
            return entry.getElementsByTagName("id")[0].textContent;
          },
          get link () {
            var temp = entry.getElementsByTagName("link")[0].getAttribute("href").replace("http://", "https://");
            temp = fixID (temp);
            return temp;
          }
        }
      }
      var rtn = [];
      tmp.forEach(function (entry) {
        rtn.push(new toObj(entry));
      });
      return rtn;
    }
  }
}

server.Email = function (feed, timeout) {
  var d, ids = [], pCount = 0;

  return {
    execute: function () {
      d = app.Promise.defer();
      var url = feed + "?rand=" + Math.round(Math.random() * 10000000);
      new app.get(url, null, null, timeout).then(
        function (req) {
          if (req.status != 200) {
            return d.resolve({
              network: req.status !== 0,
              notAuthorized: req.status === 401,
              xml: null,
              newIDs: []
            });
          }
          var xml = new server.Parser(req, feed);
          //Cleaning old entries
          var cIDs = xml.entries.map(function (e) {
            return e.id;
          });
          //Finding new ids
          var newIDs = cIDs.filter(function (id) {
            return ids.indexOf(id) === -1;
          });
          ids.push.apply(ids, newIDs);
          if (pCount >= 20 && pCount >= xml.fullcount) {
            newIDs = [];
          }
          pCount = xml.fullcount;
          d.resolve({
            network: true,
            notAuthorized: false,
            xml: xml,
            newIDs: newIDs
          });
        }
      );
      return d.promise;
    },
    reject: function () {
      if (d) d.reject();
    }
  }
}
