// Visto JavaScript Framework (VistoJS) v3.0.0
// (c) Rico Suter - http://visto.codeplex.com/
// License: Microsoft Public License (Ms-PL) (https://visto.codeplex.com/license)
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", "libs/hashchange"], function (require, exports, __hashchange) {
    "use strict";
    /// <reference path="jquery.d.ts" />
    /// <reference path="knockout.d.ts" />
    /// <reference path="q.d.ts" />
    /// <reference path="visto.modules.d.ts" />
    exports.__hashchange = __hashchange;
    // ----------------------------
    // Globals
    // ----------------------------
    var urlNavigationHistory = [];
    // ----------------------------
    // Constants
    // ----------------------------
    var lazyViewLoadingOption = "lazyLoading";
    var isPageParameter = "__isPage";
    var isDialogParameter = "__isDialog";
    var defaultPackage = "app";
    // ----------------------------
    // Initializer
    // ----------------------------
    /**
     * Initializes the framework and navigates to the first page or restores the pages.
     */
    function initialize(options) {
        var rootElement = options.rootElement === undefined ? $("body") : options.rootElement;
        var vistoContext = new VistoContext();
        vistoContext.setUserLanguage(options.supportedLanguages);
        vistoContext.resourceManager = options.resourceManager === undefined ? new ResourceManager() : options.resourceManager;
        vistoContext.initialLoadingScreenElement = options.initialLoadingScreenElement === undefined ? $(rootElement).find("div") : options.initialLoadingScreenElement;
        if (options.registerEnterKeyFix === undefined || options.registerEnterKeyFix) {
            $(document).bind("keypress", function (ev) {
                if (ev.keyCode === 13 && ev.target.localName === "input")
                    ev.preventDefault();
            });
        }
        var factory = new ViewFactory();
        return factory.create($(rootElement), null, options.startView, options.startParameters, vistoContext).then(function () {
            return vistoContext;
        });
    }
    exports.initialize = initialize;
    // ----------------------------
    // Context
    // ----------------------------
    var currentViewContext = null;
    var currentContext = null;
    var VistoContext = (function () {
        function VistoContext() {
            // ----------------------------
            // Internationalization
            // ----------------------------
            this.language = ko.observable(null);
            this.languageStrings = {};
            this.languageLoadings = {};
            this.previousLanguage = null;
            this.supportedLanguages = [];
            // ----------------------------
            // Paging
            // ----------------------------
            this.frame = null;
            this.isNavigating = false;
            this.canNavigateBack = ko.observable(false);
            this.pageStackSize = ko.observable(0);
            this.currentNavigationPath = "";
            this.navigationCount = 0;
            this.pageStack = [];
            this.isPageRestore = false;
            this.backNavigationResolve = null;
            this.backNavigationReject = null;
            // ----------------------------
            // Loading screen
            // ----------------------------
            this.initialLoadingScreenElement = null;
            this.loadingCount = 0;
            this.currentLoadingScreenElement = null;
            this.loadingScreenElement = "<div class=\"loading-screen\"><img src=\"Content/Images/loading.gif\" class=\"loading-screen-image\" alt=\"Loading...\" /></div>";
        }
        /**
         * Loads a translated string as observable object which updates when the language changes.
         */
        VistoContext.prototype.getObservableString = function (key, packageName) {
            var observable = ko.observable();
            observable(this.getString(key, packageName, function (value) { observable(value); }));
            return observable;
        };
        /**
         * Sets the language of the application.
         */
        VistoContext.prototype.setLanguage = function (lang, supportedLangs) {
            if (this.language() !== lang) {
                if (supportedLangs !== null && supportedLangs !== undefined)
                    this.supportedLanguages = supportedLangs;
                if (this.supportedLanguages.indexOf(lang) === -1)
                    throw "setLanguage: The provided language is not supported.";
                this.previousLanguage = this.language();
                this.language(lang);
            }
        };
        /**
         * Sets the language to the user preferred language.
         */
        VistoContext.prototype.setUserLanguage = function (supportedLangs) {
            var newLanguage;
            if (navigator.userLanguage !== undefined)
                newLanguage = navigator.userLanguage.split("-")[0];
            else
                newLanguage = navigator.language.split("-")[0];
            if (this.supportedLanguages.indexOf(newLanguage) !== -1)
                this.setLanguage(newLanguage, supportedLangs);
            else
                this.setLanguage(supportedLangs[0], supportedLangs);
        };
        /**
         * Loads a translated string for a given language.
         */
        VistoContext.prototype.getStringForLanguage = function (lang, packageName, key, completed) {
            var value = this.languageStrings[lang][packageName][key];
            if (value === undefined)
                value = packageName + ":" + key;
            if (completed !== undefined)
                completed(value);
            return value;
        };
        /**
         * Loads the language file for the given package and current language with checking.
         */
        VistoContext.prototype.loadLanguageStrings = function (packageName) {
            var _this = this;
            var lang = this.language();
            if (this.languageStrings[lang] === undefined)
                this.languageStrings[lang] = ([]);
            var key = packageName + ":" + lang;
            if (this.languageStrings[lang][packageName] === undefined) {
                if (this.languageLoadings[key] === undefined) {
                    this.languageLoadings[key] = this.resourceManager.getLanguageStrings(packageName, lang).then(function (ls) {
                        _this.languageStrings[lang][packageName] = ls;
                        return ls;
                    });
                }
            }
            return this.languageLoadings[key];
        };
        /**
         * Loads a translated string.
         */
        VistoContext.prototype.getString = function (key, packageName, completed) {
            var _this = this;
            packageName = getPackageName(packageName);
            var lang = this.language();
            if (this.languageStrings[lang] === undefined)
                this.languageStrings[lang] = ([]);
            if (this.languageStrings[lang][packageName] === undefined) {
                this.loadLanguageStrings(packageName).done(function () {
                    _this.getStringForLanguage(lang, packageName, key, completed);
                });
                // Not loaded yet
                if (this.previousLanguage !== null)
                    return this.getStringForLanguage(this.previousLanguage, packageName, key);
                return null;
            }
            else
                return this.getStringForLanguage(lang, packageName, key, completed);
        };
        VistoContext.prototype.showDialog = function (a, b, c) {
            if (typeof a === "string")
                return this.showDialogCore(a, b);
            else
                return this.showDialogCore(getViewName(a, b), c);
        };
        VistoContext.prototype.showDialogCore = function (fullViewName, parameters) {
            var _this = this;
            return Q.Promise(function (resolve, reject) {
                var container = $(document.createElement("div"));
                $("body").append(container);
                if (parameters === undefined)
                    parameters = {};
                parameters[isDialogParameter] = true;
                _this.showLoadingScreen();
                var factory = new ViewFactory();
                return factory.create(container, null, fullViewName, parameters, _this).then(function (view) {
                    view.dialogElement = $(container.children().get(0));
                    openedDialogs++;
                    // Remove focus from element of the underlying page to avoid click events on enter press
                    var focusable = $("a,frame,iframe,label,input,select,textarea,button:first");
                    if (focusable != null) {
                        focusable.focus();
                        focusable.blur();
                    }
                    exports.showNativeDialog(view.dialogElement, view, parameters, function () {
                        view.onShown();
                    }, function () {
                        openedDialogs--;
                        view.onClosed();
                        view.__destroyView();
                        container.remove();
                        resolve(view);
                    });
                    container.css("visibility", "");
                    container.css("position", "");
                    _this.hideLoadingScreen();
                }, reject);
            });
        };
        /**
         * Gets the current page from the given frame or the default frame.
         */
        VistoContext.prototype.getCurrentPage = function () {
            var description = this.getCurrentPageDescription();
            if (description !== null && description !== undefined)
                return description.view;
            return null;
        };
        VistoContext.prototype.getCurrentPageDescription = function () {
            var pageStack = this.getPageStack();
            if (pageStack.length > 0)
                return pageStack[pageStack.length - 1];
            return null;
        };
        VistoContext.prototype.getPageStack = function () {
            return this.pageStack;
        };
        VistoContext.prototype.tryNavigateForward = function (element, fullViewName, parameters, frame, onHtmlLoaded, onDomUpdated) {
            var _this = this;
            if (parameters === undefined || parameters == null)
                parameters = {};
            parameters[isPageParameter] = true;
            var factory = new ViewFactory();
            return factory.create(element, getViewFromElement(frame.get(0)), fullViewName, parameters, this, function (view) {
                element.get(0).vistoView = view;
                var restoreQuery = view.parameters.getRestoreQuery();
                _this.currentNavigationPath = _this.currentNavigationPath + "/" + encodeURIComponent(view.viewName + (restoreQuery !== undefined && restoreQuery !== null ? (":" + restoreQuery) : ""));
                if (_this.frame !== null)
                    window.location = "#" + _this.currentNavigationPath;
                urlNavigationHistory.push(view.context);
                var currentPage = _this.getCurrentPageDescription();
                if (currentPage !== null && currentPage !== undefined) {
                    currentPage.element.css("visibility", "hidden");
                    currentPage.element.css("position", "absolute");
                }
                // show next page by removing hiding css styles
                if (!_this.isPageRestore) {
                    element.css("visibility", "");
                    element.css("position", "");
                }
                var pageStack = _this.getPageStack();
                pageStack.push({
                    view: view,
                    hash: ++_this.navigationCount,
                    element: element
                });
                _this.canNavigateBack(pageStack.length > 1);
                _this.pageStackSize(pageStack.length);
                log("Navigated to\n" +
                    "  New page: " + view.viewClass + "\n" +
                    "  Page stack size: " + pageStack.length);
                view.__tryCallMethodRecursive("onNavigatedTo", ["forward"]);
                if (currentPage !== null && currentPage !== undefined)
                    currentPage.view.__tryCallMethodRecursive("onNavigatedFrom", ["forward"]);
                if ($.isFunction(onHtmlLoaded))
                    onHtmlLoaded(view);
                return view;
            }, onDomUpdated);
        };
        VistoContext.prototype.initializeFrame = function (frame, a, b, c) {
            if (typeof a === "string")
                return this.initializeFrameCore(frame, a, b);
            else
                return this.initializeFrameCore(frame, getViewName(a, b), c);
        };
        VistoContext.prototype.initializeFrameCore = function (frame, fullViewName, parameters) {
            var _this = this;
            return Q.Promise(function (resolve, reject) {
                if (_this.frame !== null)
                    throw new Error("The default frame is already initialized.");
                _this.frame = frame;
                var urlSegments = decodeURIComponent(window.location.hash).split("/");
                if (urlSegments.length > 1) {
                    _this.isPageRestore = true;
                    _this.showLoadingScreen(false);
                    var currentSegmentIndex = 1;
                    var navigateToNextSegment = function (view) {
                        var segment = urlSegments[currentSegmentIndex];
                        if (segment != null) {
                            var segmentParts = segment.split(":");
                            var supportsPageRestore = segmentParts.length === 3;
                            if (supportsPageRestore) {
                                currentSegmentIndex++;
                                var fullViewName = segmentParts[0] + ":" + segmentParts[1];
                                var restoreQuery = segmentParts.length === 3 ? segmentParts[2] : undefined;
                                _this.navigateTo(fullViewName, { restoreQuery: restoreQuery }).then(function (view) {
                                    navigateToNextSegment(view);
                                }).done();
                            }
                            else {
                                _this.finishPageRestore(view);
                                resolve(null);
                            }
                        }
                        else {
                            _this.finishPageRestore(view);
                            resolve(null);
                        }
                    };
                    navigateToNextSegment(null);
                }
                else
                    _this.navigateTo(fullViewName, parameters).then(function () { return resolve(null); }, reject);
            });
        };
        VistoContext.prototype.finishPageRestore = function (view) {
            this.hideLoadingScreen();
            this.isPageRestore = false;
            var page = this.getCurrentPageDescription();
            page.element.css("visibility", "");
            page.element.css("position", "");
        };
        VistoContext.prototype.navigateTo = function (a, b, c) {
            if (typeof a === "string")
                return this.navigateToCore(a, b);
            else
                return this.navigateToCore(getViewName(a, b), c);
        };
        VistoContext.prototype.navigateToCore = function (fullViewName, parameters) {
            var _this = this;
            if (this.frame === null)
                throw "Frame is not set";
            if (this.isNavigating)
                throw "Already navigating";
            this.isNavigating = true;
            // append new invisible page to DOM
            var pageContainer = $(document.createElement("div"));
            pageContainer.css("visibility", "hidden");
            pageContainer.css("position", "absolute");
            pageContainer.attr("visto-page", fullViewName);
            this.frame.append(pageContainer);
            // load currently visible page
            var currentPage = this.getCurrentPageDescription();
            this.showLoadingScreen(currentPage !== null);
            if (currentPage !== null && currentPage !== undefined && $.isFunction(currentPage.view.onNavigatingFrom)) {
                return currentPage.view.onNavigatingFrom("forward").then(function (navigate) {
                    if (navigate) {
                        return _this.tryNavigateForward(pageContainer, fullViewName, parameters, _this.frame, undefined, function (page) {
                            _this.hideLoadingScreen();
                            _this.isNavigating = false;
                            return page;
                        });
                    }
                    else
                        _this.isNavigating = false;
                    return null;
                });
            }
            else {
                return this.tryNavigateForward(pageContainer, fullViewName, parameters, this.frame, undefined, function (page) {
                    _this.hideLoadingScreen();
                    _this.isNavigating = false;
                    return page;
                });
            }
        };
        /**
         * Navigates back to the home page (first page in stack).
         */
        VistoContext.prototype.navigateHome = function () {
            var _this = this;
            if (this.navigationCount <= 1) {
                return Q(null);
            }
            else {
                return this.navigateBack().then(function () {
                    return _this.navigateHome();
                });
            }
        };
        /**
         * Navigates to the previous page.
         */
        VistoContext.prototype.navigateBack = function () {
            var _this = this;
            return Q.Promise(function (resolve, reject) {
                if (_this.isNavigating)
                    reject("Already navigating");
                else {
                    _this.backNavigationResolve = resolve;
                    _this.backNavigationReject = reject;
                    history.go(-1);
                }
            });
        };
        VistoContext.prototype.triggerNavigateBack = function () {
            var _this = this;
            if (this.isNavigating)
                return; // TODO: What to do here? Go forward?
            var pageStack = this.getPageStack();
            if (pageStack.length > 1) {
                var currentPage = pageStack[pageStack.length - 1];
                if (currentPage !== null && currentPage !== undefined) {
                    var count = 0, pos = 0;
                    while ((pos = window.location.hash.indexOf("/", pos + 1)) !== -1)
                        count++;
                    if (currentPage.hash !== count) {
                        this.currentNavigationPath = this.currentNavigationPath.substring(0, this.currentNavigationPath.lastIndexOf("/"));
                        this.isNavigating = true;
                        if (openedDialogs > 0)
                            this.tryNavigateBack(false, currentPage, pageStack);
                        else {
                            if ($.isFunction(currentPage.view.onNavigatingFrom)) {
                                currentPage.view.onNavigatingFrom("back").then(function (navigate) {
                                    _this.tryNavigateBack(navigate, currentPage, pageStack);
                                }).done();
                            }
                            else
                                this.tryNavigateBack(true, currentPage, pageStack);
                        }
                    }
                }
            }
        };
        VistoContext.prototype.tryNavigateBack = function (navigate, currentPage, pageStack) {
            if (navigate) {
                urlNavigationHistory.pop();
                this.navigationCount--;
                var previousPage = pageStack[pageStack.length - 2];
                currentPage.view.__destroyView();
                pageStack.pop();
                this.canNavigateBack(pageStack.length > 1);
                this.pageStackSize(pageStack.length);
                currentPage.element.remove();
                previousPage.element.css("visibility", "visible");
                previousPage.element.css("position", "");
                log("Navigated back to\n" +
                    "  Page: " + previousPage.view.viewClass + "\n" +
                    "  Page stack size: " + pageStack.length);
                previousPage.view.__tryCallMethodRecursive("onNavigatedTo", ["back"]);
                previousPage.view.__tryCallMethodRecursive("onNavigatedFrom", ["back"]);
                if ($.isFunction(this.backNavigationResolve))
                    this.backNavigationResolve();
            }
            else {
                if (this.frame !== null)
                    window.location = "#" + currentPage.hash;
                if ($.isFunction(this.backNavigationReject))
                    this.backNavigationReject("Cannot navigate back.");
            }
            this.isNavigating = false;
            this.backNavigationResolve = null;
            this.backNavigationReject = null;
        };
        /**
         * Shows the loading screen. Always call hideLoadingScreen() for each showLoadingScreen() call.
         */
        VistoContext.prototype.showLoadingScreen = function (delayed) {
            var _this = this;
            if (this.loadingCount === 0) {
                if (delayed == undefined || delayed) {
                    setTimeout(function () {
                        if (_this.loadingCount > 0)
                            _this.appendLoadingElement();
                    }, exports.loadingScreenDelay);
                }
                else
                    this.appendLoadingElement();
            }
            this.loadingCount++;
        };
        VistoContext.prototype.appendLoadingElement = function () {
            if (this.initialLoadingScreenElement !== null) {
                this.initialLoadingScreenElement.remove();
                this.initialLoadingScreenElement = null;
            }
            if (this.currentLoadingScreenElement === null) {
                this.currentLoadingScreenElement = $(this.loadingScreenElement);
                $("body").append(this.currentLoadingScreenElement);
            }
        };
        /**
         * Hides the loading screen.
         */
        VistoContext.prototype.hideLoadingScreen = function () {
            this.loadingCount--;
            if (this.loadingCount === 0) {
                if (this.currentLoadingScreenElement !== null) {
                    this.currentLoadingScreenElement.remove();
                    this.currentLoadingScreenElement = null;
                }
            }
        };
        return VistoContext;
    }());
    exports.VistoContext = VistoContext;
    (function (DialogResult) {
        DialogResult[DialogResult["Undefined"] = 0] = "Undefined";
        DialogResult[DialogResult["Ok"] = 1] = "Ok";
        DialogResult[DialogResult["Cancel"] = 2] = "Cancel";
        DialogResult[DialogResult["Yes"] = 3] = "Yes";
        DialogResult[DialogResult["No"] = 4] = "No";
    })(exports.DialogResult || (exports.DialogResult = {}));
    var DialogResult = exports.DialogResult;
    // Public
    exports.loadingScreenDelay = 300;
    exports.isLogging = true;
    // Variables
    var views = {};
    var viewCount = 0;
    var openedDialogs = 0;
    // Local variables
    var tagAliases = {};
    // ----------------------------
    // Tag aliases
    // ----------------------------
    /**
     * Registers an alias for a tag; specify the tag without 'vs-'.
     */
    function registerTagAlias(tag, pkg, viewPath) {
        if (tagAliases[tag] !== undefined)
            throw new Error("The tag alias '" + tag + "' is already registered.");
        if (typeof pkg === "string")
            tagAliases[tag] = pkg + ":" + viewPath;
        else
            tagAliases[tag] = getPackageNameForModule(pkg) + ":" + viewPath;
    }
    exports.registerTagAlias = registerTagAlias;
    function getViewForViewModel(viewModel) {
        return viewModel.view;
    }
    exports.getViewForViewModel = getViewForViewModel;
    // ----------------------------
    // Internal helper methods
    // ----------------------------
    // Logs the string to the console if logging is enabled
    function log(value) {
        if (exports.isLogging)
            console.log(new Date().toLocaleTimeString() + ": " + value);
    }
    ;
    // Tries to load a module using RequireJS
    function tryRequire(moduleName) {
        return Q.Promise(function (resolve) {
            require([moduleName], function (module) { resolve(module); }, function () { resolve(null); });
        });
    }
    ;
    // Checks whether a string ends with a given suffix
    function endsWith(data, suffix) {
        return data.indexOf(suffix, data.length - suffix.length) !== -1;
    }
    ;
    // Checks whether a string starts with a given prefix
    function startsWith(data, prefix) {
        return data.indexOf(prefix) === 0;
    }
    ;
    // Converts a dashed string ('my-string') into a camel case string (myString)
    function convertDashedToCamelCase(data) {
        return data.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
    }
    // Converts a camel case string (myString) into a dashed string ('my-string')
    function convertCamelCaseToDashed(data) {
        return data.replace(/([A-Z])/g, function (g) { return "-" + g.toLowerCase(); });
    }
    // ----------------------------
    // Remoting
    // ----------------------------
    var remotePaths = {};
    function registerRemotePath(path, remoteUrl) {
        if (remotePaths[path.toLowerCase()] !== undefined)
            throw new Error("The remote path '" + path + "' is already registered.");
        remotePaths[path.toLowerCase()] = remoteUrl;
    }
    exports.registerRemotePath = registerRemotePath;
    function getRemotePathBaseUrl(path) {
        return remotePaths[path.toLowerCase()] !== undefined ? remotePaths[path.toLowerCase()] + "/" : "";
    }
    var originalDefine = define;
    define = (function (modules, success, failed) {
        if ($.isArray(modules)) {
            for (var path in remotePaths) {
                if (remotePaths.hasOwnProperty(path)) {
                    $.each(modules, function (index, module) {
                        if (module.toLowerCase().indexOf(path + "/") === 0)
                            modules[index] = remotePaths[path] + "/Scripts/" + module + ".js";
                    });
                }
            }
        }
        originalDefine(modules, success, failed);
    });
    // ----------------------------
    // Package management
    // ----------------------------
    function getChildPackage(parentView, fallbackPackage) {
        if (parentView.inheritPackageFromParent) {
            var parent = parentView.viewParent;
            while (parent !== undefined && parent !== null && parent.inheritPackageFromParent)
                parent = parent.viewParent;
            return parent !== undefined && parent !== null ? parent.viewPackage : fallbackPackage;
        }
        else
            return parentView.viewPackage;
    }
    /**
     * Gets the package name of the given path.
     */
    function getPackageName(path) {
        if (path === undefined || path === null)
            return defaultPackage;
        if (path[path.length - 1] !== "/")
            return path;
        return path;
    }
    ;
    /**
     * Gets the package name where the given module is located.
     */
    function getPackageNameForModule(module) {
        var modulePath = "/" + module.id.replace("//Scripts/", "").replace("/Scripts/", "");
        var index = modulePath.lastIndexOf("/views/");
        if (index === -1)
            index = modulePath.lastIndexOf("/viewModels/");
        if (index === -1)
            index = modulePath.lastIndexOf("/");
        return index === -1 ? defaultPackage : modulePath.substr(1, index - 1);
    }
    exports.getPackageNameForModule = getPackageNameForModule;
    /**
     * Gets the full view name for the view from the given module and path.
     */
    function getViewName(module, viewPath) {
        return getPackageNameForModule(module) + ":" + viewPath;
    }
    exports.getViewName = getViewName;
    // ----------------------------
    // Events
    // ----------------------------
    var Event = (function () {
        function Event(sender) {
            this.registrations = [];
            this.sender = sender;
        }
        Event.prototype.add = function (callback) {
            this.registrations.push(callback);
        };
        Event.prototype.remove = function (callback) {
            var index = this.registrations.indexOf(callback);
            if (index > -1)
                this.registrations.splice(index, 1);
        };
        Event.prototype.raise = function (args) {
            for (var _i = 0, _a = this.registrations; _i < _a.length; _i++) {
                var callback = _a[_i];
                callback(this.sender, args);
            }
        };
        return Event;
    }());
    exports.Event = Event;
    // ----------------------------
    // Views
    // ----------------------------
    /**
     * Gets the view or parent view of the given element.
     */
    function getViewFromElement(element) {
        var context = ko.contextFor(element);
        if (context !== undefined && context !== null && context.$parent !== undefined && context.$parent !== null)
            return context.$parent.view;
        return null;
    }
    exports.getViewFromElement = getViewFromElement;
    ;
    /**
     * Gets the parent view of the given element.
     */
    function getParentViewFromElement(element) {
        var parent = element.parentNode;
        if (parent !== undefined && parent !== null) {
            var context = ko.contextFor(parent);
            if (context !== undefined && context !== null && context.$parent !== undefined && context.$parent !== null)
                return context.$parent.view;
        }
        return null;
    }
    exports.getParentViewFromElement = getParentViewFromElement;
    ;
    /**
     * Gets the parent view model of the given element.
     */
    function getViewModelForElement(element) {
        var view = getViewFromElement(element.get(0));
        if (view !== null && view !== undefined)
            return view.viewModel;
        return null;
    }
    exports.getViewModelForElement = getViewModelForElement;
    /**
     * Registers an initializer which is called after the elements of the context are added to the DOM.
     * This is used for custom ko bindings so that they work correctly if they assume that an element is already in the DOM.
     * Call this in custom ko bindings to run code after element has been added to the DOM.
     */
    function addInitializer(completed) {
        if (currentViewContext === null)
            completed();
        else
            currentViewContext.initializers.push(completed);
    }
    exports.addInitializer = addInitializer;
    ;
    //Register callback when user manually navigates back (back key)
    $(window).hashchange(function () {
        if (urlNavigationHistory.length > 1) {
            var context = urlNavigationHistory[urlNavigationHistory.length - 1];
            context.triggerNavigateBack();
        }
    });
    // ----------------------------
    // Dialogs
    // ----------------------------
    /**
     * [Replaceable] Creates and shows a native dialog (supports Bootstrap and jQuery UI dialogs).
     */
    exports.showNativeDialog = function (container, view, parameters, onShown, onClosed) {
        var dialog = container;
        if (dialog.modal !== undefined) {
            // Bootstrap dialog
            dialog.modal({});
            dialog.on("shown.bs.modal", function () { onShown(); });
            dialog.on("hidden.bs.modal", function () { onClosed(); });
        }
        else {
            // JQuery UI dialog: 
            dialog.bind('dialogclose', function () {
                dialog.dialog("destroy");
                onClosed();
            });
            onShown();
        }
    };
    /**
     * [Replaceable] Closes the native dialog (supports Bootstrap and jQuery UI dialogs).
     */
    exports.closeNativeDialog = function (container) {
        var dialog = container;
        if (dialog.modal !== undefined) {
            // Bootstrap dialog
            dialog.modal("hide");
        }
        else {
            // JQuery UI dialog
            dialog.dialog("close");
        }
    };
    // ----------------------------
    // KnockoutJS extensions
    // ----------------------------
    // Handler to instantiate views directly in HTML (e.g. <span data-bind="view: { name: ... }" />)
    ko.bindingHandlers["view"] = {
        init: function () {
            return { controlsDescendantBindings: true };
        },
        update: function (elem, valueAccessor) {
            var value = ko.utils.unwrapObservable(valueAccessor());
            var viewName = value.name;
            // destroy if view is already loaded and only viewName has changed
            var view = elem.vistoView;
            if (view !== undefined && view !== null) {
                if (view.viewName === viewName || view.viewName === view.viewPackage + ":" + viewName)
                    return; // only rebuild when viewName changed
                log("Refreshing view: \n" +
                    "  Old view: " + view.viewName + "\n" +
                    "  New view '" + viewName + "\n" +
                    "  View ID: " + view.viewId);
                view.__destroyView();
            }
            var last = null;
            var first = ko.virtualElements.firstChild(elem);
            var child = first;
            while (child) {
                last = child;
                child = ko.virtualElements.nextSibling(child);
            }
            var html = "";
            var isFirstFound = false;
            for (var i = 0; i < elem.parentNode.childNodes.length; i++) {
                var node = elem.parentNode.childNodes[i];
                if (node === first)
                    isFirstFound = true;
                if (isFirstFound) {
                    var wrap = document.createElement('div');
                    wrap.appendChild(node.cloneNode(true));
                    html += wrap.innerHTML;
                }
                if (node === last)
                    break;
            }
            ko.virtualElements.emptyNode(elem);
            value.__htmlBody = html;
            var element = $(document.createElement("div"));
            // find context
            var parentView = getParentViewFromElement(elem);
            if (parentView === null)
                parentView = getViewFromElement(elem);
            var context = parentView != null ? parentView.context : currentContext;
            if (context === null)
                throw "Could not find Visto context.";
            var factory = new ViewFactory();
            factory.create($(element), parentView, viewName, value, context, function (view) {
                elem.vistoView = view;
                ko.utils.domNodeDisposal.addDisposeCallback(elem, function () {
                    view.__destroyView();
                });
                if (parentView !== null)
                    parentView.__addSubView(view);
                view.__setHtml = false;
            }, function (view) {
                ko.virtualElements.setDomNodeChildren(elem, view.elementNodes);
            }).done();
        }
    };
    ko.virtualElements.allowedBindings["view"] = true;
    // ----------------------------
    // View model
    // ----------------------------
    var ViewModel = (function () {
        function ViewModel(view, parameters) {
            this.context = null;
            /**
             * Gets the root view model.
             */
            this.rootViewModel = null;
            /**
             * Gets the parent view model.
             * The usage of the parent view model should be avoided to avoid high coupling between views.
             */
            this.parentViewModel = null;
            this.view = view;
            this.parameters = parameters;
        }
        /**
         * Enables page restoring for the current page.
         * This method must be called in the initialize() method.
         * Page restore only works for a page if all previous pages in the page stack support page restore.
         */
        ViewModel.prototype.enablePageRestore = function (restoreQuery) {
            this.parameters.setRestoreQuery(restoreQuery === undefined ? "" : restoreQuery);
        };
        /**
         * Subscribes to the given subscribable and stores the subscription automatic clean up.
         */
        ViewModel.prototype.subscribe = function (subscribable, callback) {
            this.view.subscribe(subscribable, callback);
        };
        /**
         * Loads a translated string.
         */
        ViewModel.prototype.getString = function (key) {
            return this.view.getString(key);
        };
        /**
         * Loads a translated string which is internally observed (should only be called in a view, e.g. <vs-my-view my-text="translate('key')">).
         */
        ViewModel.prototype.translate = function (key) {
            return this.view.context.getObservableString(key, this.view.viewPackage)();
        };
        /**
         * [Virtual] Initializes the view before it is added to the DOM.
         */
        ViewModel.prototype.initialize = function (parameters) {
            // must be empty
        };
        /**
         * [Virtual] Called when the view has been added to the DOM.
         */
        ViewModel.prototype.onLoaded = function () {
            // must be empty
        };
        /**
         * [Virtual] Called before the view is added to the DOM with the ability to perform async work.
         * The callback() must be called when the work has been performed.
         */
        ViewModel.prototype.onLoading = function () {
            return Q(null);
        };
        /**
         * [Virtual] Called to clean up resources when the view has been removed from the DOM.
         */
        ViewModel.prototype.destroy = function () {
            // must be empty
        };
        return ViewModel;
    }());
    exports.ViewModel = ViewModel;
    // ----------------------------
    // View
    // ----------------------------
    var ViewBase = (function () {
        function ViewBase() {
            /**
             * Gets the element container which contains the view HTML markup (not available in ctor, initialize() and onLoading()).
             */
            this.elementNodes = null;
            /**
             * Gets the view's parent view.
             */
            this.viewParent = null;
            /**
             * Gets the view's direct child views.
             */
            this.viewChildren = ko.observableArray();
            /**
             * Gets or sets a value indicating whether the package scope for child views is inherited from the parent view.
             * The property must be set in the view's initialize() method.
             */
            this.inheritPackageFromParent = false;
            /**
             * Gets or sets a value indicating whether the view should use the view model of the parent view and thus no own view model is instantiated.
             * The property must be set in the view's initialize() method.
             * The view cannot have an own view model class.
             */
            this.inheritRootViewModel = false;
            this.isDestroyed = false;
            this.subViews = [];
            this.disposables = [];
            this.context = null;
            this.isViewLoaded = ko.observable(false);
            this.__setHtml = true;
        }
        /**
         * Enables page restoring for the current page.
         * This method must be called in the initialize() method.
         * Page restore only works for a page if all previous pages in the page stack support page restore.
         */
        ViewBase.prototype.enablePageRestore = function (restoreQuery) {
            this.viewModel.enablePageRestore(restoreQuery);
        };
        /**
         * Subscribes to the given subscribable and stores the subscription automatic clean up.
         */
        ViewBase.prototype.subscribe = function (subscribable, callback) {
            var subscription = subscribable.subscribe(callback);
            this.disposables.push(subscription);
            return subscription;
        };
        /**
         * Loads a translated string.
         */
        ViewBase.prototype.getString = function (key) {
            return this.context.getString(key, this.viewPackage);
        };
        /**
         * Gets an element by ID (defined using the "vs-id" attribute) inside this view.
         */
        ViewBase.prototype.getViewElement = function (id) {
            var element = $();
            var selector = "#" + this.viewId + "_" + id;
            if (this.elementNodes.length !== 0)
                element = $(this.elementNodes[0].parentNode).find(selector);
            if (element.length === 0)
                console.warn("Could not find view element " + selector + " in view " + this.viewName + ".");
            return element;
        };
        // event methods
        /**
         * [Virtual] Initializes the view before it is added to the DOM.
         */
        ViewBase.prototype.initialize = function (parameters) {
            // must be empty
        };
        /**
         * [Virtual] Called before the view is added to the DOM with the ability to perform async work.
         * The callback() must be called when the work has been performed.
         */
        ViewBase.prototype.onLoading = function () {
            return Q(null);
        };
        /**
         * [Virtual] Called when the view has been added to the DOM.
         */
        ViewBase.prototype.onLoaded = function () {
            // must be empty
        };
        /**
         * [Virtual] Called to clean up resources when the view has been removed from the DOM.
         */
        ViewBase.prototype.destroy = function () {
            // must be empty
        };
        // ReSharper disable InconsistentNaming
        ViewBase.prototype.__destroyView = function () {
            $.each(this.subViews, function (index, view) {
                view.__destroyView();
            });
            if (!this.isDestroyed) {
                log("Destroying view\n" +
                    "  View: " + this.viewId + "' (" + this.viewClass + ")\n" +
                    "  # of subviews: " + this.subViews.length);
                delete views[this.viewId];
                this.viewModel.destroy();
                this.destroy();
                $.each(this.disposables, function (index, item) {
                    item.dispose();
                });
                if (this.viewParent != null)
                    this.viewParent.viewChildren.remove(this);
                this.isDestroyed = true;
                for (var j = 0; j < this.elementNodes.length; j++)
                    ko.cleanNode(this.elementNodes[j]); // unapply bindings
            }
        };
        ViewBase.prototype.__setViewParent = function (viewParent) {
            if (this.viewParent !== null)
                throw "Parent view has already been set.";
            this.viewParent = viewParent;
            if (this.viewParent != null)
                this.viewParent.viewChildren.push(this);
        };
        ViewBase.prototype.__addSubView = function (view) {
            this.subViews.push(view);
        };
        ViewBase.prototype.__tryCallMethod = function (methodName, args) {
            if ($.isFunction(this[methodName]))
                return this[methodName].apply(this, args);
            return undefined;
        };
        ViewBase.prototype.__tryCallMethodRecursive = function (methodName, args) {
            ko.utils.arrayForEach(this.viewChildren(), function (child) {
                child.__tryCallMethodRecursive(methodName, args);
            });
            return this.__tryCallMethod(methodName, args);
        };
        return ViewBase;
    }());
    exports.ViewBase = ViewBase;
    var View = (function (_super) {
        __extends(View, _super);
        function View() {
            _super.apply(this, arguments);
        }
        return View;
    }(ViewBase));
    exports.View = View;
    // ----------------------------
    // Page
    // ----------------------------
    var Page = (function (_super) {
        __extends(Page, _super);
        function Page() {
            _super.apply(this, arguments);
        }
        /**
         * [Virtual] Called when navigated to this page (type may be 'back' or 'forward').
         */
        Page.prototype.onNavigatedTo = function (type) {
            // must be empty
        };
        /**
         * [Virtual] Called after navigated from this page (type may be 'back' or 'forward').
         */
        Page.prototype.onNavigatedFrom = function (type) {
            // must be empty
        };
        /**
         * [Virtual] Called when navigating to this page (type may be 'back' or 'forward').
         * The callback() must be called with a boolean stating whether to navigate or cancel the navigation operation.
         */
        Page.prototype.onNavigatingFrom = function (type) {
            return Q(true);
        };
        return Page;
    }(View));
    exports.Page = Page;
    var PageBase = (function (_super) {
        __extends(PageBase, _super);
        function PageBase() {
            _super.apply(this, arguments);
        }
        return PageBase;
    }(Page));
    exports.PageBase = PageBase;
    // ----------------------------
    // Dialog
    // ----------------------------
    var Dialog = (function (_super) {
        __extends(Dialog, _super);
        function Dialog() {
            _super.apply(this, arguments);
            /**
             * Gets the dialog result.
             */
            this.result = DialogResult.Undefined;
        }
        /**
         * Closes the dialog.
         */
        Dialog.prototype.close = function (result) {
            this.result = result;
            exports.closeNativeDialog(this.dialogElement);
        };
        /**
         * [Virtual] Called when the dialog is shown and all animations have finished.
         */
        Dialog.prototype.onShown = function () {
        };
        /**
         * [Virtual] Called after the dialog has been closed.
         */
        Dialog.prototype.onClosed = function () {
        };
        return Dialog;
    }(View));
    exports.Dialog = Dialog;
    var DialogBase = (function (_super) {
        __extends(DialogBase, _super);
        function DialogBase() {
            _super.apply(this, arguments);
        }
        return DialogBase;
    }(Dialog));
    exports.DialogBase = DialogBase;
    // ----------------------------
    // Parameters
    // ----------------------------
    var Parameters = (function () {
        function Parameters(fullViewName, parameters) {
            this.parameters = {};
            this.originalParameters = {};
            if (parameters === undefined || parameters === null)
                parameters = {};
            this.fullViewName = fullViewName;
            this.originalParameters = parameters;
            this.tagContentHtml = parameters.__htmlBody !== undefined ? parameters.__htmlBody : "";
            var content = $(document.createElement("div"));
            content.html(this.tagContentHtml);
            this.tagContent = content;
        }
        Parameters.prototype.getObservableString = function (key, defaultValue) {
            return this.getObservableWithConversion(key, function (value) { return value.toString(); }, defaultValue);
        };
        Parameters.prototype.getObservableNumber = function (key, defaultValue) {
            return this.getObservableWithConversion(key, function (value) { return Number(value); }, defaultValue);
        };
        Parameters.prototype.getObservableBoolean = function (key, defaultValue) {
            return this.getObservableWithConversion(key, function (value) { return value.toString().toLowerCase() === "true"; }, defaultValue);
        };
        Parameters.prototype.getObservableObject = function (key, defaultValue) {
            return this.getObservableWithConversion(key, function (value) { return value; }, defaultValue);
        };
        Parameters.prototype.getString = function (key, defaultValue) {
            return this.getObservableString(key, defaultValue)();
        };
        Parameters.prototype.getNumber = function (key, defaultValue) {
            return this.getObservableNumber(key, defaultValue)();
        };
        Parameters.prototype.getBoolean = function (key, defaultValue) {
            return this.getObservableBoolean(key, defaultValue)();
        };
        Parameters.prototype.getObject = function (key, defaultValue) {
            return this.getObservableObject(key, defaultValue)();
        };
        /**
         * Gets a function parameter and sets the this/caller to the parent element's view model if no caller is set.
         */
        Parameters.prototype.getFunction = function (key, viewModel) {
            var func = this.getObject(key, null);
            if (func === null)
                return null;
            return func;
            // TODO: Fix this
            //return function () {
            //    if (func.caller !== undefined && func.caller !== null)
            //        return func;
            //    var parentElement = (<any>viewModel).view.element.parent()[0];
            //    var parentViewModel = ko.contextFor(parentElement).$data;
            //    return func.apply(parentViewModel, arguments);
            //};
        };
        Parameters.prototype.setValue = function (key, value) {
            var observable = this.getObservableObject(key, value);
            observable(value);
        };
        Parameters.prototype.getRestoreQuery = function () {
            return this.originalParameters["restoreQuery"];
        };
        Parameters.prototype.setRestoreQuery = function (restoreQuery) {
            this.originalParameters["restoreQuery"] = restoreQuery;
        };
        Parameters.prototype.getObservableArray = function (key, defaultValue) {
            if (this.parameters[key] === undefined) {
                if (this.originalParameters[key] !== undefined) {
                    if (this.originalParameters[key].notifySubscribers !== undefined)
                        this.parameters[key] = this.originalParameters[key];
                    else
                        this.parameters[key] = ko.observableArray(this.originalParameters[key]);
                }
                else {
                    var tagContentChild = this.readTagContentChild(key);
                    if (tagContentChild !== null)
                        this.parameters[key] = ko.observableArray(tagContentChild);
                    else if (defaultValue !== undefined)
                        this.parameters[key] = ko.observableArray(defaultValue);
                    else
                        throw new Error("The parameter '" + key + "' is not defined and no default value is provided in view '" + this.fullViewName + "'.");
                }
            }
            return this.parameters[key];
        };
        Parameters.prototype.getObservableWithConversion = function (key, valueConverter, defaultValue) {
            if (this.parameters[key] === undefined) {
                if (this.originalParameters[key] !== undefined) {
                    if (this.originalParameters[key].notifySubscribers !== undefined)
                        this.parameters[key] = this.originalParameters[key];
                    else
                        this.parameters[key] = ko.observable(valueConverter(this.originalParameters[key]));
                }
                else {
                    var tagContentChild = this.readTagContentChild(key);
                    if (tagContentChild !== null)
                        this.parameters[key] = ko.observable(tagContentChild);
                    else if (defaultValue !== undefined)
                        this.parameters[key] = ko.observable(defaultValue);
                    else
                        throw new Error("The parameter '" + key + "' is not defined and no default value is provided in view '" + this.fullViewName + "'.");
                }
            }
            return this.parameters[key];
        };
        Parameters.prototype.readTagContentChild = function (key) {
            var tagName = convertCamelCaseToDashed(key);
            var elements = $.grep(this.tagContent.children().get(), function (element) { return element.tagName.toLowerCase() === tagName; });
            if (elements.length === 1)
                return this.createObjectFromElement($(elements[0]));
            return null;
        };
        Parameters.prototype.createObjectFromElement = function (element) {
            var _this = this;
            var children = element.children();
            if (children.length > 0) {
                var array = [];
                children.each(function (index, child) {
                    array.push(_this.createObjectFromElement($(child)));
                });
                return array;
            }
            else {
                var object = {};
                object["htmlElement"] = element;
                $.each(element.get(0).attributes, function (index, attr) {
                    object[convertDashedToCamelCase(attr.name)] = attr.value;
                });
                return object;
            }
        };
        return Parameters;
    }());
    exports.Parameters = Parameters;
    // ----------------------------
    // View factory
    // ----------------------------
    var ResourceManager = (function () {
        function ResourceManager() {
            this.loadedViews = ([]);
        }
        ResourceManager.prototype.getViewModules = function (packageName, viewName) {
            var viewModule = null;
            var viewModelModule = null;
            var viewUrl = this.getViewModuleUrl(packageName, viewName);
            var viewModelUrl = this.getViewModelModuleUrl(packageName, viewName);
            var baseUrl = getRemotePathBaseUrl(packageName);
            if (baseUrl !== "") {
                viewUrl = baseUrl + viewUrl;
                viewModelUrl = baseUrl + viewModelUrl;
            }
            var promises = [
                tryRequire(viewUrl).then(function (m) {
                    viewModule = m;
                }),
                tryRequire(viewModelUrl).then(function (m) {
                    viewModelModule = m;
                })
            ];
            return Q.all(promises).then(function () {
                return {
                    'viewModule': viewModule,
                    'viewModelModule': viewModelModule
                };
            });
        };
        ResourceManager.prototype.getViewModuleUrl = function (packageName, viewName) {
            return packageName + "/views/" + viewName;
        };
        ResourceManager.prototype.getViewModelModuleUrl = function (packageName, viewName) {
            return packageName + "/viewModels/" + viewName + "Model";
        };
        /**
         * [Replaceable] Loads the translated string for a given package and language.
         */
        ResourceManager.prototype.getLanguageStrings = function (packageName, lang) {
            var url = getRemotePathBaseUrl(packageName) + "Scripts/" + packageName + "/languages/" + lang + ".json";
            return Q($.ajax({
                url: url,
                type: "get",
                dataType: "json",
                global: false
            })).then(function (result) {
                return result;
            }).catch(function (reason) {
                log("Error loading language strings '" + url + "' (" + reason + " )");
                return {};
            });
        };
        ResourceManager.prototype.getViewHtml = function (packageName, viewName) {
            var _this = this;
            var name = packageName + ":" + viewName;
            var hasPromise = this.loadedViews[name] !== undefined;
            if (!hasPromise) {
                var baseUrl = getRemotePathBaseUrl(packageName);
                this.loadedViews[name] = Q($.ajax({
                    url: baseUrl + "Scripts/" + packageName + "/views/" + viewName + ".html",
                    dataType: "html",
                    global: false
                })).then(function (data) {
                    data = _this.processCustomTags(data);
                    data = _this.processKnockoutAttributes(data);
                    return data;
                }).catch(function () {
                    return "<span>[View '" + name + "' not found]</span>";
                });
            }
            return this.loadedViews[name];
        };
        /**
         * Process custom tags in the given HTML data string.
         */
        ResourceManager.prototype.processCustomTags = function (data) {
            data = data
                .replace(/vs-translate="(.*?)"/g, function (match, key) { return 'vs-html="{translate(\'' + key + '\')}"'; })
                .replace(/vs-bind="/g, "data-bind=\"")
                .replace(/<vs-([a-zA-Z0-9-]+?)(( ([^]*?)(\/>|>))|(\/>|>))/g, function (match, tagName, tagWithoutAttributesClosing, unused2, attributes, tagClosing) {
                if (tagClosing == undefined) {
                    tagClosing = tagWithoutAttributesClosing;
                    attributes = "";
                }
                var path = "";
                var pkg = "";
                var bindings = "";
                var htmlAttributes = "";
                attributes.replace(/([a-zA-Z0-9-]*?)="([^]*?)"/g, function (match, attributeName, attributeValue) {
                    if (attributeName.indexOf("vs-") === 0) {
                        htmlAttributes += " " + match; // TODO: Why?
                        return match;
                    }
                    else {
                        attributeName = convertDashedToCamelCase(attributeName.trim());
                        if (attributeName === "path")
                            path = attributeValue;
                        else if (attributeName === "package")
                            pkg = attributeValue;
                        else if (startsWith(attributeValue, "{") && endsWith(attributeValue, "}")) {
                            attributeValue = attributeValue.substr(1, attributeValue.length - 2);
                            if (attributeValue.indexOf("(") > -1)
                                attributeValue = "ko.pureComputed(function () { return " + attributeValue + "; })";
                            bindings += attributeName + ": " + attributeValue + ", ";
                        }
                        else
                            bindings += attributeName + ": '" + attributeValue + "', ";
                        return match;
                    }
                });
                var view = convertDashedToCamelCase(tagName);
                view = view[0].toUpperCase() + view.substr(1);
                view = path === "" ? view : path + "/" + view;
                if (tagAliases[tagName] !== undefined)
                    bindings += "name: '" + tagAliases[tagName] + "'";
                else
                    bindings += "name: " + (pkg === "" ? "'" + view + "'" : "'" + pkg + ":" + view + "'");
                return '<!-- ko view: { ' + bindings + ' } -->' + htmlAttributes + (tagClosing === "/>" ? "<!-- /ko -->" : "");
            });
            data = data.replace(/<\/vs-([a-zA-Z0-9-]+?)>/g, "<!-- /ko -->");
            return data;
        };
        /**
         * Process Knockout attributes (vs-) in the given HTML data string (must be called after processCustomTags).
         */
        ResourceManager.prototype.processKnockoutAttributes = function (data) {
            data = data.replace(/<([a-zA-Z0-9-]+?) ([^]*?)(\/>|>)/g, function (match, tagName, attributes, tagClosing) {
                var existingDataBindValue = "";
                var additionalDataBindValue = "";
                attributes = attributes.replace(/([a-zA-Z0-9-]+?)="([^]*?)"/g, function (match, key, value) {
                    if (key.indexOf("vs-") === 0 && key !== "vs-id") {
                        var knockoutBindingHandler = convertDashedToCamelCase(key.substr(3));
                        var knockoutBindingValue = (value.length > 0 && value[0] === "{" ? value.substr(1, value.length - 2) : "'" + value + "'");
                        additionalDataBindValue += ", " + knockoutBindingHandler + ": " + knockoutBindingValue;
                        return "";
                    }
                    else if (key === "data-bind") {
                        existingDataBindValue = value;
                        return "";
                    }
                    else
                        return match;
                });
                if (existingDataBindValue !== "" || additionalDataBindValue !== "") {
                    if (existingDataBindValue === "")
                        additionalDataBindValue = additionalDataBindValue.substr(2); // remove unused ", "
                    return "<" + tagName + " " + attributes + " data-bind=\"" + existingDataBindValue + additionalDataBindValue + "\"" + tagClosing;
                }
                return match;
            });
            return data.replace(/{{(.*?)}}/g, function (g) { return "<span data-bind=\"text: " + g.substr(2, g.length - 4) + "\"></span>"; });
        };
        return ResourceManager;
    }());
    exports.ResourceManager = ResourceManager;
    var BundledResourceManager = (function (_super) {
        __extends(BundledResourceManager, _super);
        function BundledResourceManager() {
            _super.apply(this, arguments);
            this.loadBundles = true;
        }
        BundledResourceManager.prototype.loadPackageBundle = function (packageName) {
            var bundleModule = packageName + "/package";
            var fullBundleModule = bundleModule;
            var baseUrl = getRemotePathBaseUrl(packageName);
            if (baseUrl !== "")
                fullBundleModule = baseUrl + "Scripts/" + bundleModule + ".js";
            return tryRequire(fullBundleModule).then(function (bundle) {
                if (bundle === undefined && baseUrl !== "") {
                    return tryRequire(bundleModule);
                }
                else
                    return bundle;
            });
        };
        BundledResourceManager.prototype.getViewModules = function (packageName, viewName) {
            var _this = this;
            if (!this.loadBundles)
                return _super.prototype.getViewModules.call(this, packageName, viewName);
            var viewUrl = packageName + "/views/" + viewName;
            var viewModelUrl = packageName + "/viewModels/" + viewName + "Model";
            return this.loadPackageBundle(packageName).then(function (bundle) {
                if (bundle !== undefined && bundle !== null && bundle.views[viewName] !== undefined) {
                    var viewModule = null;
                    var viewModelModule = null;
                    var promises = [];
                    var view = bundle.views[viewName];
                    if (view.hasView) {
                        promises.push(tryRequire(viewUrl).then(function (m) {
                            viewModule = m;
                        }));
                    }
                    if (view.hasViewModel) {
                        promises.push(tryRequire(viewModelUrl).then(function (m) {
                            viewModelModule = m;
                        }));
                    }
                    return Q.all(promises).then(function () {
                        return {
                            'viewModule': viewModule,
                            'viewModelModule': viewModelModule
                        };
                    });
                }
                else
                    return _super.prototype.getViewModules.call(_this, packageName, viewName);
            });
        };
        BundledResourceManager.prototype.getViewHtml = function (packageName, viewName) {
            var _this = this;
            if (!this.loadBundles)
                return _super.prototype.getViewHtml.call(this, packageName, viewName);
            return this.loadPackageBundle(packageName).then(function (bundle) {
                if (bundle !== null && bundle !== undefined && bundle.views[viewName] !== undefined) {
                    var html = bundle.views[viewName].html;
                    html = _this.processCustomTags(html);
                    return _this.processKnockoutAttributes(html);
                }
                else
                    return _super.prototype.getViewHtml.call(_this, packageName, viewName);
            });
        };
        return BundledResourceManager;
    }(ResourceManager));
    exports.BundledResourceManager = BundledResourceManager;
    var ViewFactory = (function () {
        function ViewFactory() {
        }
        ViewFactory.prototype.create = function (element, viewParent, fullViewName, parameters, context, onHtmlLoaded, onDomUpdated) {
            var _this = this;
            this.element = element;
            this.context = context;
            if (currentViewContext === undefined || currentViewContext === null) {
                // from foreach, other late-bindings or root view
                this.viewContext = new ViewFactoryContext();
                this.viewContext.viewParent = viewParent;
                this.isRootView = true;
            }
            else {
                this.viewContext = currentViewContext;
                this.isRootView = false;
            }
            this.viewParent = this.viewContext.viewParent;
            this.viewLocator = new ViewLocator(fullViewName, this.viewContext);
            this.parameters = new Parameters(fullViewName, parameters);
            element.html("");
            var lazySubviewLoading = this.parameters.getBoolean(lazyViewLoadingOption, false);
            if (!lazySubviewLoading)
                this.viewContext.viewCount++;
            var moduleLoader = context.resourceManager.getViewModules(this.viewLocator.package, this.viewLocator.view);
            var languageLoader = context.loadLanguageStrings(this.viewLocator.package);
            return Q.all([moduleLoader, languageLoader]).spread(function (modules) {
                _this.viewModule = modules.viewModule;
                _this.viewModelModule = modules.viewModelModule;
                return context.resourceManager.getViewHtml(_this.viewLocator.package, _this.viewLocator.view);
            }).then(function (data) {
                return _this.loadHtml(data, context, onHtmlLoaded, onDomUpdated);
            }).then(function (view) {
                return view;
            });
        };
        ViewFactory.prototype.loadHtml = function (htmlData, context, onHtmlLoaded, onDomUpdated) {
            var _this = this;
            this.viewId = "view_" + ++viewCount;
            htmlData = htmlData
                .replace(/vs-id="/g, "id=\"" + this.viewId + "_")
                .replace(/\[\[viewid\]\]/gi, this.viewId);
            var container = $(document.createElement("div"));
            container.html(htmlData);
            this.containerElement = container;
            this.view = this.instantiateView();
            this.viewModel = this.instantiateViewModel(this.view);
            this.view.context = context;
            this.viewModel.context = context;
            // initialize and retrieve restore query
            this.view.initialize(this.parameters);
            this.viewModel.initialize(this.parameters);
            // load parent view model
            if (this.view.viewParent !== null) {
                this.viewModel.rootViewModel = this.view.inheritRootViewModel ?
                    this.view.viewParent.viewModel.rootViewModel :
                    this.viewModel;
            }
            else
                this.viewModel.rootViewModel = this.viewModel;
            if (this.isRootView)
                this.viewContext.restoreQuery = this.parameters.getRestoreQuery();
            var lazySubviewLoading = this.parameters.getBoolean(lazyViewLoadingOption, false);
            if (lazySubviewLoading) {
                this.__setHtml();
                this.applyBindings();
                this.__raiseLoadedEvents();
                return Q(this.view);
            }
            else {
                this.viewContext.factories.push(this);
                this.viewContext.viewParent = this.view;
                this.viewContext.parentPackage = this.viewLocator.package;
                try {
                    currentContext = context;
                    currentViewContext = this.viewContext;
                    this.applyBindings();
                }
                finally {
                    currentViewContext = null;
                    currentContext = null;
                }
                if ($.isFunction(onHtmlLoaded))
                    onHtmlLoaded(this.view);
                return this.viewContext.finalizeView(this.view, onDomUpdated).then(function () {
                    return _this.view;
                });
            }
        };
        ViewFactory.prototype.applyBindings = function () {
            try {
                log("Apply bindings: \n" +
                    "  View ID: " + this.viewId + "\n" +
                    "  View: " + this.view.viewName + " (parent: " + (this.view.viewParent != null ? this.view.viewParent.viewName : "n/a") + ")\n" +
                    "  ViewModel: " + this.viewModel.view.viewName + "Model\n" +
                    "  RootViewModel: " + this.viewModel.rootViewModel.view.viewName + "Model" +
                    (this.viewModel.parentViewModel !== null ? "\n  ParentViewModel: " +
                        this.viewModel.parentViewModel.view.viewName + "Model" : ""));
                ko.applyBindings(this.viewModel, this.containerElement.get(0));
            }
            catch (err) {
                console.error("Error applying bindings: \n" +
                    "  View ID: " + this.viewId + "\n" +
                    "  View: " + this.view.viewName + " (parent: " + (this.view.viewParent != null ? this.view.viewParent.viewName : "n/a") + ")\n" +
                    "  ViewModel: " + this.viewModel.view.viewName + "Model\n" +
                    "  RootViewModel: " + this.viewModel.rootViewModel.view.viewName + "Model" +
                    (this.viewModel.parentViewModel !== null ? "\n  ParentViewModel: " +
                        this.viewModel.parentViewModel.view.viewName + "Model" : "") +
                    "  Check if view model could be loaded and bound property/expression is available/correct\n" +
                    err.stack + "\nBound HTML:");
                console.warn(this.viewModel);
                console.warn(this.containerElement.get(0).innerHTML);
                throw err;
            }
        };
        ViewFactory.prototype.instantiateView = function () {
            var view;
            var hasView = this.viewModule !== undefined && this.viewModule !== null;
            if (hasView) {
                if (this.viewModule[this.viewLocator.className] === undefined)
                    throw "Could not find class " + this.viewLocator.className + " in view module.";
                view = (new this.viewModule[this.viewLocator.className]());
            }
            else {
                if (this.parameters.getBoolean(isPageParameter, false))
                    view = new Page();
                else if (this.parameters.getBoolean(isDialogParameter, false))
                    view = new Dialog();
                else
                    view = new View();
            }
            var childNodesCopy = [];
            var childNodes = this.containerElement.get(0).childNodes;
            for (var j = 0; j < childNodes.length; j++)
                childNodesCopy.push(childNodes[j]);
            view.elementNodes = childNodesCopy;
            view.viewId = this.viewId;
            view.viewName = this.viewLocator.name;
            view.viewClass = this.viewLocator.className;
            view.viewPackage = this.viewLocator.package;
            view.parameters = this.parameters;
            view.__setViewParent(this.viewParent);
            views[this.viewId] = view;
            return view;
        };
        ViewFactory.prototype.instantiateViewModel = function (view) {
            var viewModel;
            var hasViewModel = this.viewModelModule !== undefined && this.viewModelModule !== null;
            if (hasViewModel) {
                if (this.viewModelModule[this.viewLocator.className + "Model"] === undefined)
                    throw "Could not find class " + this.viewLocator.className + "Model in view model module.";
                viewModel = (new this.viewModelModule[this.viewLocator.className + "Model"](view, this.parameters));
            }
            else
                viewModel = new ViewModel(view, this.parameters);
            view.viewModel = viewModel;
            view.viewModel.parentViewModel = view.viewParent !== null ? view.viewParent.viewModel : null;
            return viewModel;
        };
        // ReSharper disable InconsistentNaming
        ViewFactory.prototype.__raiseLoadedEvents = function () {
            this.view.onLoaded();
            this.viewModel.onLoaded();
            this.view.isViewLoaded(true);
        };
        ViewFactory.prototype.__setHtml = function () {
            if (this.view.__setHtml) {
                this.element.empty();
                for (var i = 0; i < this.view.elementNodes.length; i++) {
                    var child = this.view.elementNodes[i];
                    this.element.get(0).appendChild(child);
                }
            }
        };
        return ViewFactory;
    }());
    var ViewFactoryContext = (function () {
        function ViewFactoryContext() {
            this.factories = [];
            this.initializers = [];
            this.parentPackage = defaultPackage;
            this.viewParent = null;
            this.viewCount = 0;
            this.restoreQuery = undefined;
            this.loadedViewCount = 0;
        }
        ViewFactoryContext.prototype.finalizeView = function (view, onDomUpdated) {
            var _this = this;
            // TODO: Refactor this! => also reject exceptions!
            return Q.Promise(function (resolve, reject) {
                _this.initializers.push(function () {
                    if ($.isFunction(onDomUpdated))
                        onDomUpdated(view);
                    resolve(_this);
                });
                _this.loadedViewCount++;
                if (_this.loadedViewCount === _this.viewCount) {
                    _this.loadedViewCount = 0;
                    $.each(_this.factories, function (index, context) {
                        try {
                            context.view.onLoading().then(function () {
                                _this.loadedViewCount++;
                                if (_this.loadedViewCount === _this.viewCount) {
                                    _this.loadedViewCount = 0;
                                    $.each(_this.factories, function (index, context) {
                                        try {
                                            context.viewModel.onLoading().then(function () {
                                                _this.loadedViewCount++;
                                                if (_this.loadedViewCount === _this.viewCount) {
                                                    try {
                                                        $.each(_this.factories.reverse(), function (index, factory) {
                                                            factory.__setHtml();
                                                        });
                                                        $.each(_this.initializers, function (index, initializer) {
                                                            initializer();
                                                        });
                                                        $.each(_this.factories, function (index, factory) {
                                                            factory.__raiseLoadedEvents();
                                                        });
                                                    }
                                                    catch (e) {
                                                        reject(e);
                                                    }
                                                }
                                            }).done();
                                        }
                                        catch (e) {
                                            reject(e);
                                        }
                                    });
                                }
                            }).done();
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                }
            });
        };
        return ViewFactoryContext;
    }());
    var ViewLocator = (function () {
        function ViewLocator(fullViewName, context) {
            if (fullViewName.indexOf(":") !== -1) {
                var arr = fullViewName.split(":");
                this.package = getPackageName(arr[0]);
                this.view = arr[1];
            }
            else {
                if (context.viewParent != null)
                    this.package = getChildPackage(context.viewParent, context.parentPackage);
                else
                    this.package = context.parentPackage;
                this.view = fullViewName;
            }
            this.name = this.package + ":" + this.view;
            var index = this.view.lastIndexOf("/");
            if (index !== -1)
                this.className = this.view.substr(index + 1);
            else
                this.className = this.view;
        }
        return ViewLocator;
    }());
});
//# sourceMappingURL=visto.js.map