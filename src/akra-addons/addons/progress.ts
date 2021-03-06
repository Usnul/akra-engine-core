﻿/// <reference path="../../../built/Lib/akra.d.ts" />

declare var AE_PROGRESS_CSS: any;
declare var AE_PROGRESS_YOUTUBE: any;

module akra.addons {

	import addons = config.addons;

	addons['progress'] = addons['progress'] || { "css": null };
	addons['progress']["css"] = addons['progress']["css"] || (uri.currentPath() + AE_PROGRESS_CSS.content);

	debug.log("config['addons']['progress'] = ", JSON.stringify(addons['progress']));

	if (document.createStyleSheet) {
		document.createStyleSheet(addons['progress']["css"]);
	}
	else {
		var sStyles: string = "@import url(' " + addons['progress']["css"] + " ');";
		var pLink: HTMLLinkElement = <HTMLLinkElement>document.createElement('link');

		pLink.rel = 'stylesheet';
		pLink.href = 'data:text/css,' + escape(sStyles);
		document.getElementsByTagName("head")[0].appendChild(pLink);
	}

	var code = AE_DEBUG ?
		"<div class='ae-preloader'>" +
			"<div class='ae-title'>" +
				"LOADING" +
			"</div>" +
			"<div class='ae-circle'>" +
				"<div id='' class='circle_1 circle'></div>" +
				"<div id='' class='circle_2 circle'></div>" +
				"<div id='' class='circle_3 circle'></div>" +
				"<div id='' class='circle_4 circle'></div>" +
				"<div id='' class='circle_5 circle'></div>" +
				"<div id='' class='circle_6 circle'></div>" +
				"<div id='' class='circle_7 circle'></div>" +
				"<div class='clearfix'></div>" +
			"</div>" +
			"<div class='ae-progress' style='margin-bottom: 20px;'>" +
				"<span class='ae-string'>Acquiring&nbsp;</span>" +
				"<span class='ae-string ae-tip'></span>" +
				"<div class='ae-bar'>" +
					"<div class='ae-complete'>" +
					"</div>" +
				"</div>" +
			"</div>" +
			"<div class='ae-progress' style='margin-bottom: 20px;'>" +
				"<span class='ae-string'>Applying&nbsp;</span>" +
				"<span class='ae-string ae-tip'></span>" +
				"<div class='ae-bar'>" +
					"<div class='ae-complete'>" +
					"</div>" +
				"</div>" +
			"</div>" +
			"<div class='ae-watch-video' onclick=\"window.open('" + "http://www.youtube.com/watch?v=LN4n0pTxWYs" + "', '_blank').focus()\">" +
				"<table><tr>" +
					"<td><img src='" + uri.currentPath() + AE_PROGRESS_YOUTUBE.content + "' /></td>" +
					"<td>you can watch the <br />video while loading</td>" +
					"</tr></table>" + 
			"</div>" + 
		"</div>" :
		"<div class='ae-preloader'>" +
			"<div class='ae-progress'>" +
				"<div class='ae-bar'>" +
					"<div class='ae-complete'>" +
					"</div>" +
				"</div>" +
				"<div class='ae-bar' style='margin-top: 3px;'>" +
					"<div class='ae-complete'>" +
					"</div>" +
				"</div>" +
			"</div>" +
			"<div class='ae-watch-video' onclick=\"window.open('" + "http://www.youtube.com/watch?v=LN4n0pTxWYs" + "', '_blank').focus()\">" +
				"<table><tr>" +
					"<td><img src='" + uri.currentPath() + AE_PROGRESS_YOUTUBE.content + "' /></td>" +
					"<td>you can watch the <br />video while loading</td>" +
					"</tr></table>" + 
			"</div>" + 
		"</div>"


	export class Progress {
		private acquiring: HTMLDivElement;
		private acquiringTip: HTMLSpanElement;

		private applying: HTMLDivElement;
		private applyingTip: HTMLSpanElement;

		constructor(pElement: HTMLElement, bRender?: boolean);
		constructor(pCanvas: HTMLCanvasElement, bRender?: boolean);
		constructor(private element: HTMLElement = null, bRender: boolean = true) {

			if (bRender) {
				this.render();
			}
		}

		render(): void {
			var el: HTMLUnknownElement = <HTMLUnknownElement>akra.conv.parseHTML(code)[0];
			if (isNull(this.element)) {
				this.element = <HTMLElement>el;
				document.body.appendChild(this.element);
			}
			else {
				if (this.element instanceof HTMLCanvasElement) {
					this.element.parentNode.appendChild(el);

					
					var x = 0;
					var y = 0;
					var e = this.element;
					while (e && !isNaN(e.offsetLeft) && !isNaN(e.offsetTop)) {
						x += e.offsetLeft - e.scrollLeft;
						y += e.offsetTop - e.scrollTop;
						e = <HTMLElement>e.offsetParent;
					}

					el.setAttribute("style",
						"position: absolute; z-index: 9999; left: " +
						(x + this.element.offsetWidth / 2. - el.offsetWidth / 2.) + "px; top: " +
						(y + this.element.offsetHeight / 2. - el.offsetHeight / 2.) + "px;");
				}
				else {
					this.element.appendChild(el);
				}
			}


			var pBars: HTMLDivElement[] = <HTMLDivElement[]><any>document.getElementsByClassName('ae-complete');
			var pTips: HTMLSpanElement[] = <HTMLSpanElement[]><any>document.getElementsByClassName('ae-tip');

			if (AE_DEBUG) {
				this.acquiringTip = pTips[0];
				this.acquiring = pBars[0];


				this.applying = pBars[1];
				this.applyingTip = pTips[1];
			}
			else {
				this.acquiring = pBars[0];
				this.applying = pBars[1];
			}
		}

		destroy(): void {
			
			if (AE_DEBUG) {
				this.element.className += " bounceOutRight";
				setTimeout(() => {
					this.element.parentNode.removeChild(this.element);
				}, 2000);
			}
			else {
				this.element.parentNode.removeChild(this.element);
			}
		}

		getListener(): (e: IDepEvent) => void {
			
			return (e: IDepEvent): void => {

				if (AE_DEBUG) {
					this.setAcquiringTip((e.bytesLoaded / 1000).toFixed(0) + ' / ' + (e.bytesTotal / 1000).toFixed(0) + ' kb');
					this.setApplyingTip(e.loaded + ' / ' + e.total);
				}

				this.setAcquiring(e.bytesLoaded / e.bytesTotal);
				this.setApplying(e.unpacked);

				// if (e.loaded === e.total) {
					//this.destroy();
				// }
			}
		}

		private setAcquiring(fValue: float): void {
			this.acquiring.style.width = (fValue * 100).toFixed(3) + '%';
		}

		private setApplying(fValue: float): void {
			this.applying.style.width = (fValue * 100).toFixed(3) + '%';
		}

		private setApplyingTip(sTip: string): void {
			this.applyingTip.innerHTML = sTip;
		}

		private setAcquiringTip(sTip: string): void {
			this.acquiringTip.innerHTML = sTip;
		}
	}
}