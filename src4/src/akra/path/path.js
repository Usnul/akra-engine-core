var akra;
(function (akra) {
    /// <reference path="../idl/IPathinfo.ts" />
    /// <reference path="../logger.ts" />
    (function (path) {
        var Info = (function () {
            function Info(pPath) {
                this._sDirname = null;
                this._sExtension = null;
                this._sFilename = null;
                if (isDef(pPath)) {
                    this.set(pPath);
                }
            }
            Object.defineProperty(Info.prototype, "path", {
                get: /**  */ function () {
                    return this.toString();
                },
                set: /**  */ function (sPath) {
                    this.set(sPath);
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Info.prototype, "dirname", {
                get: /**  */ function () {
                    return this._sDirname;
                },
                set: /**  */ function (sDirname) {
                    this._sDirname = sDirname;
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Info.prototype, "filename", {
                get: /**  */ function () {
                    return this._sFilename;
                },
                set: /**  */ function (sFilename) {
                    this._sFilename = sFilename;
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Info.prototype, "ext", {
                get: /**  */ function () {
                    return this._sExtension;
                },
                set: /**  */ function (sExtension) {
                    this._sExtension = sExtension;
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Info.prototype, "basename", {
                get: /**  */ function () {
                    return (this._sFilename ? this._sFilename + (this._sExtension ? "." + this._sExtension : "") : "");
                },
                set: /**  */ function (sBasename) {
                    var nPos = sBasename.lastIndexOf(".");

                    if (nPos < 0) {
                        this._sFilename = sBasename.substr(0);
                        this._sExtension = null;
                    } else {
                        this._sFilename = sBasename.substr(0, nPos);
                        this._sExtension = sBasename.substr(nPos + 1);
                    }
                },
                enumerable: true,
                configurable: true
            });


            Info.prototype.set = function (sPath) {
                if (isString(sPath)) {
                    var pParts = sPath.replace('\\', '/').split('/');

                    this.basename = pParts.pop();

                    this._sDirname = pParts.join('/');
                } else if (sPath instanceof Info) {
                    this._sDirname = sPath.dirname;
                    this._sFilename = sPath.filename;
                    this._sExtension = sPath.ext;
                } else if (isNull(sPath)) {
                    return null;
                } else {
                    //critical_error
                    logger.error("Unexpected data type was used.", sPath);
                }
            };

            Info.prototype.isAbsolute = function () {
                return this._sDirname[0] === "/";
            };

            Info.prototype.toString = function () {
                return (this._sDirname ? this._sDirname + "/" : "") + (this.basename);
            };
            return Info;
        })();

        function normalizeArray(parts, allowAboveRoot) {
            // if the path tries to go above the root, `up` ends up > 0
            var up = 0;
            for (var i = parts.length - 1; i >= 0; i--) {
                var last = parts[i];
                if (last === '.') {
                    parts.splice(i, 1);
                } else if (last === "..") {
                    parts.splice(i, 1);
                    up++;
                } else if (up) {
                    parts.splice(i, 1);
                    up--;
                }
            }

            if (allowAboveRoot) {
                for (; up--; up) {
                    parts.unshift("..");
                }
            }

            return parts;
        }

        function normalize(sPath) {
            var info = info(sPath);
            var isAbsolute = info.isAbsolute();
            var tail = info.dirname;
            var trailingSlash = /[\\\/]$/.test(tail);

            tail = normalizeArray(tail.split(/[\\\/]+/).filter(function (p) {
                return !!p;
            }), !isAbsolute).join("/");

            if (tail && trailingSlash) {
                tail += "/";
            }

            info.dirname = (isAbsolute ? "/" : "") + tail;

            return info.toString();
        }
        path.normalize = normalize;

        function parse(path) {
            return new Info(path);
        }
        path.parse = parse;
    })(akra.path || (akra.path = {}));
    var path = akra.path;
})(akra || (akra = {}));
