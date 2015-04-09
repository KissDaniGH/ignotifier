var app = {};

/* exports */
app.Promise = Promise;

app.button = (function () {
  var callback;
  chrome.browserAction.onClicked.addListener(function(tab) {
    if (callback) {
      callback();
    }
  });
  return {
    onCommand: function (c) {
      callback = c;
    },
    onContext: function () {},
    onClick: function () {},
    set label (val) {
      chrome.browserAction.setTitle({
        title: val
      })
    },
    set badge (val) {
      chrome.browserAction.setBadgeText({
        text: (val ? val : "") + ""
      });
    },
    set color (val) {
      chrome.browserAction.setIcon({
        path: "../../../data/icons/" + val + "/19.png"
      });
    }
  }
})();

app.popup = (function () {
  return {
    show: function () { },
    hide: function () {
      var popup = chrome.extension.getViews({type:'popup'})[0];
      if (popup) {
        popup.close();
      }
    },
    attach: function () {
      chrome.browserAction.setPopup({
        popup: "data/popup/index.html"
      });
    },
    detach: function () {
      this.hide();
      chrome.browserAction.setPopup({
        popup: ""
      });
    },
    send: function (id, data) {
      chrome.extension.sendRequest({method: id, data: data});
    },
    receive: function (id, callback) {
      chrome.extension.onRequest.addListener(function(request, sender, c) {
        if (request.method == id && !sender.tab) {
          callback(request.data);
        }
      });
    }
  }
})();

app.timer = window;

app.get = function (url, headers, data, timeout) {
  headers = headers || {};

  var xhr = new XMLHttpRequest();
  var d = app.Promise.defer();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      d.resolve(xhr);
    }
  };
  xhr.open(data ? "POST" : "GET", url, true);
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for(e in data) {
      arr.push(e + "=" + data[e]);
    }
    data = arr.join("&");
  }
  xhr.timeout = timeout;
  xhr.send(data ? data : "");
  return d.promise;
}

app.parser = function () {
  return new DOMParser();
}

app.l10n = function (id) {
  return chrome.i18n.getMessage(id);
}

app.windows = (function () {
  function toWindow (win) {
    return {
      obj: win,
      focus: function () {
        chrome.windows.update(win.id, {
          focused: true
        });
      }
    }
  }
  function toTab(tab) {
    return {
      get url () {
        return tab.url
      },
      set url (val) {
        chrome.tabs.update(tab.id, {
          url: val
        });
      },
      activate: function () {
        chrome.tabs.update(tab.id, {
           active: true
        });
      },
      window: function () {
        var d = app.Promise.defer();
        chrome.windows.get(tab.windowId, {}, function (win) {
          d.resolve(toWindow(win));
        });
        return d.promise;
      },
      get active () {
        return tab.active;
      },
      close: function () {
        tab.close();
      }
    }
  }
  return {
    active: function () {
      var d = app.Promise.defer();
      chrome.windows.getCurrent({}, function (win) {
        d.resolve(toWindow(win));
      });
      return d.promise;
    },
    open: function (url, inBackground) {
      chrome.windows.create({
        url: url,
        focused: !inBackground
      });
    },
    tabs: {
      list: function (currentWindow) {
        var d = app.Promise.defer();
        chrome.tabs.query({
          currentWindow: currentWindow
        },function(tabs) {
          d.resolve(tabs.map(toTab));
        });
        return d.promise;
      },
      active: function () {
        var d = app.Promise.defer();
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, function (tabs) {
          d.resolve(tabs && tabs.length ? toTab(tabs[0]) : null);
        });
        return d.promise;
      },
      open: function (url, inBackground) {
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, function (tabs) {
          chrome.tabs.create({
            url: url,
            index: config.tabs.open.relatedToCurrent && tabs && tabs.length ? tabs[0].index + 1 : null,
            active: !inBackground
          });
        });
      }
    }
  }
})();

app.notify = function (text, title, callback) {
  title = title || app.l10n("gmail");
  if (config.notification.silent) return;

  var notification,
      icon = "../../../data/icons/notification/48.png";

  if (typeof window.webkitNotifications == 'undefined' && typeof Notification == 'undefined') {
    console.error('Notification dismissed', title, text);
    return; //Opera
  }

  if (window.webkitNotifications) {
    notification = webkitNotifications.createNotification(icon, title, text);
  }
  else {
    notification = new Notification(title, {
      body: text,
      icon: icon
    });
  }
  notification.onclick = function () {
    if (callback) {
      callback();
    }
  }
  window.setTimeout(function () {
    if (notification) {
      if (window.webkitNotifications) {
        notification.cancel();
      }
      else {
        notification.close();
      }
    }
  }, config.notification.time * 1000);
}

app.play = (function () {
  var audio;
  function reset () {
    audio = document.createElement('audio');
    audio.setAttribute("preload", "auto");
    audio.autobuffer = true;
    var source = document.createElement('source');
    var data = config.notification.sound.custom.file;
    var mime = config.notification.sound.mime || 'audio/wav';
    if (config.notification.sound.type === 4 && data && audio.canPlayType(mime)) {
      source.type = mime;
      source.src = data;
    }
    else {
      source.type = 'audio/wav';
      source.src = '../../../data/sounds/' + config.notification.sound.original;
    }
    audio.appendChild(source);
  }

  return {
    now: function () {
      if (config.notification.silent) return;
      if (!audio) reset();

      audio.volume = config.notification.sound.volume / 100;
      audio.load;
      audio.play();
    },
    reset: reset
  }
})();

app.clipboard = function () {}

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? "runtime" : "extension"].getManifest().version;
}

app.startup = function (c) {
  c();
}

app.unload = (function () {
  var callbacks = [];
  window.addEventListener("unload", function () {
    callbacks.forEach(function (c) {
      c()
    });
  }, false);
  return function (c) {
    callbacks.push(c);
  }
})();

app.options = {
  send: function (id, data) {
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function (tab) {
        chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function() {});
      });
    });
  },
  receive: function (id, callback) {
    chrome.extension.onRequest.addListener(function(request, sender, callback2) {
      if (request.method == id && sender.tab) {
        callback(request.data);
      }
    });
  }
}

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + "";
  }
}

app.manifest = {
  url: chrome.extension.getURL('')
}

app.tray = {
  set: function () {},
  remove: function () {},
  callback: function () {}
}
