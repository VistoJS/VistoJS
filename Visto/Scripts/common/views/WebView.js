var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", "libs/visto", "../main"], function (require, exports, visto, common) {
    var WebView = (function (_super) {
        __extends(WebView, _super);
        function WebView() {
            _super.apply(this, arguments);
        }
        WebView.prototype.onLoading = function () {
            var _this = this;
            this.url = this.parameters.getObservableString("url", "");
            this.subscribe(this.url, function (newUrl) { return _this.navigateToUrl(newUrl); });
            this.registerSubmitEvent();
            return Q($.ajax({
                type: "GET",
                url: this.url()
            })).then(function (data) {
                _this.initialHtml = data;
            }).catch(function () {
                _this.initialHtml = "[URL: Not found]";
            });
        };
        WebView.prototype.onLoaded = function () {
            this.setHtml(this.initialHtml, this.getBaseUrl(this.url()));
        };
        WebView.prototype.getBaseUrl = function (url) {
            url = url.replace("//", "||");
            if (url.lastIndexOf("/") === -1)
                return url.replace("||", "//");
            else
                return url.substring(0, url.lastIndexOf("/")).replace("||", "//");
        };
        WebView.prototype.navigateToUrl = function (url) {
            this.loadHtml({
                type: "GET",
                url: url
            });
        };
        WebView.prototype.registerSubmitEvent = function () {
            var _this = this;
            this.element.submit(function (e) {
                e.preventDefault();
                var form = $(e.target);
                _this.loadHtml({
                    type: form.attr("method"),
                    url: form.attr("action"),
                    data: form.serialize()
                });
            });
        };
        WebView.prototype.registerLinkEvents = function () {
            var _this = this;
            this.element.find("a").click(function (args) {
                var url = $(args.target).attr("href");
                _this.navigateToUrl(url);
                return false;
            });
        };
        WebView.prototype.loadHtml = function (settings) {
            var _this = this;
            if (settings.url.indexOf("://") === -1)
                settings.url = this.currentBaseUrl + "/" + settings.url;
            visto.showLoading();
            Q($.ajax(settings)).then(function (data) {
                _this.setHtml(data, _this.getBaseUrl(settings.url));
                visto.hideLoading();
            }).catch(function (exception) {
                visto.hideLoading();
                common.alert("HTTP Request failed", "HTTP Error " + exception.status + ": " + exception.statusText);
            });
        };
        WebView.prototype.setHtml = function (data, baseUrl) {
            this.currentBaseUrl = baseUrl;
            this.element.html(data);
            this.registerLinkEvents();
        };
        return WebView;
    })(visto.ViewBase);
    exports.WebView = WebView;
});
//# sourceMappingURL=WebView.js.map