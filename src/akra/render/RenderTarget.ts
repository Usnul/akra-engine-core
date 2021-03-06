/// <reference path="../idl/IRenderTarget.ts" />
/// <reference path="../idl/IDepthBuffer.ts" />
/// <reference path="../idl/IFrameStats.ts" />
/// <reference path="../idl/IPixelBuffer.ts" />

/// <reference path="Viewport.ts" />
/// <reference path="TextureViewport.ts" />
/// <reference path="DSViewport.ts" />
/// <reference path="LPPViewport.ts" />
/// <reference path="ForwardViewport.ts" />
/// <reference path="MirrorViewport.ts" />
/// <reference path="ColorViewport.ts" />
/// <reference path="ShadowViewport.ts" />

/// <reference path="../events.ts" />
/// <reference path="../pixelUtil/pixelUtil.ts" />

/// <reference path="../config/config.ts" />
/// <reference path="../guid.ts" />

module akra.render {

	export class RenderTarget implements IRenderTarget {
		guid: uint = guid();

		preUpdate: ISignal<{ (pTarget: IRenderTarget): void; }>;
		postUpdate: ISignal<{ (pTarget: IRenderTarget): void; }>;

		viewportPreUpdate: ISignal<{ (pTarget: IRenderTarget, pViewport: IViewport): void; }>;
		viewportPostUpdate: ISignal<{ (pTarget: IRenderTarget, pViewport: IViewport): void; }>;
		viewportAdded: ISignal<{ (pTarget: IRenderTarget, pViewport: IViewport): void; }>;
		viewportRemoved: ISignal<{ (pTarget: IRenderTarget, pViewport: IViewport): void; }>;

		resized: ISignal<{ (pTarget: IRenderTarget, iWidth: uint, iHeight: uint): void; }>;

		cameraRemoved: ISignal<{ (pTarget: IRenderTarget, pCamera: ICamera): void; }>;

		protected _sName: string;
		protected _pRenderer: IRenderer;

		protected _iPriority: uint = RenderTarget.DEFAULT_RT_GROUP;

		protected _iWidth: uint;
		protected _iHeight: uint;

		protected _iColorDepth: int;
		protected _pDepthBuffer: IDepthBuffer = null;
		protected _pDepthPixelBuffer: IPixelBuffer = null;

		protected _pFrameStats: IFrameStats;

		//protected _pTimer: IUtilTimer;
		protected _fLastSecond: uint;
		protected _fLastTime: uint;
		protected _iFrameCount: uint;

		protected _isActive: boolean = true;
		protected _isAutoUpdate: boolean = true;

		protected _bHwGamma: boolean = false;

		protected _pViewportList: IViewport[] = [];

		//user event handing
		private _iUserEvents: int = 0;

		constructor(pRenderer: IRenderer) {
			this.setupSignals();
			this._pRenderer = pRenderer;
			//this._pTimer = pRenderer.getEngine().getTimer();
			this._pFrameStats = {
				fps: {
					last: 0.,
					avg: 0.,
					best: 0.,
					worst: 0.
				},
				time: {
					best: 0.,
					worst: 0.
				},
				polygonsCount: 0
			}

			this.resetStatistics();
		}

		protected setupSignals(): void {
			this.preUpdate = this.preUpdate || new Signal(this);
			this.postUpdate = this.postUpdate || new Signal(this);
			
			this.viewportPreUpdate = this.viewportPreUpdate || new Signal(this);
			this.viewportPostUpdate = this.viewportPostUpdate || new Signal(this);
			this.viewportAdded = this.viewportAdded || new Signal(this);
			this.viewportRemoved = this.viewportRemoved || new Signal(this);

			this.resized = this.resized || new Signal(this);
			this.cameraRemoved = this.cameraRemoved || new Signal(this);
		}

		getWidth(): uint {
			return this._iWidth;
		}

		getHeight(): uint {
			return this._iHeight;
		}

		getColorDepth(): int {
			return this._iColorDepth;
		}

		getTotalViewports(): uint {
			return this._pViewportList.length;
		}

		getTotalFrames(): uint {
			return this._iFrameCount;
		}

		getPriority(): uint {
			return this._iPriority;
		}

		getName(): string {
			return this._sName;
		}

		setName(sName: string) {
			this._sName = sName;
		}

		enableSupportForUserEvent(iType: int): int {
			//get events that have not yet been activated
			var iNotActivate: int = (this._iUserEvents ^ 0x7fffffff) & iType;

			this._iUserEvents = bf.setAll(this._iUserEvents, iNotActivate);

			return iNotActivate;
		}

		isUserEventSupported(eType: EUserEvents): boolean {
			return bf.testAny(this._iUserEvents, <int>eType);
		}

		getRenderer(): IRenderer { return this._pRenderer; }

		destroy(): void {
			var pViewport: IViewport;

			for (var i in this._pViewportList) {
				pViewport = this._pViewportList[i];
				this.viewportRemoved.emit(pViewport)
				pViewport.destroy();
			}

			this.detachDepthBuffer();

			debug.log("RenderTarget '%s'\n Average FPS: %s\n Best FPS: %s\n Worst FPS: %s",
				this._sName,
				this._pFrameStats.fps.avg,
				this._pFrameStats.fps.best,
				this._pFrameStats.fps.worst);
		}

		getDepthBuffer(): IDepthBuffer {
			return this._pDepthBuffer;
		}

		attachDepthBuffer(pBuffer: IDepthBuffer): boolean {
			var isOk: boolean = false;

			if ((isOk = pBuffer.isCompatible(this))) {
				this.detachDepthBuffer();
				this._pDepthBuffer = pBuffer;
				this._pDepthBuffer._notifyRenderTargetAttached(this);
			}

			return isOk;
		}

		attachDepthPixelBuffer(pBuffer: IPixelBuffer): boolean {

			if (this._iWidth !== pBuffer.getWidth() ||
				this._iHeight !== pBuffer.getHeight()) {
				return false;
			}

			var eFormat: EPixelFormats = pBuffer.getFormat();
			if (eFormat !== EPixelFormats.FLOAT32_DEPTH ||
				eFormat !== EPixelFormats.DEPTH8) {
				return false;
			}

			this.detachDepthPixelBuffer();
			this._pDepthPixelBuffer = pBuffer;

			return true;
		}

		detachDepthPixelBuffer(): void {
			if (this._pDepthPixelBuffer) {
				this._pDepthPixelBuffer = null;
			}
		}

		detachDepthBuffer(): void {
			if (this._pDepthBuffer) {
				this._pDepthBuffer._notifyRenderTargetDetached(this);
				this._pDepthBuffer = null;
			}
		}

		attachDepthTexture(pTexture: ITexture): boolean {
			return false;
		}

		detachDepthTexture(): void {

		}

		_detachDepthBuffer(): void {
			this._pDepthBuffer = null;
		}


		_beginUpdate(): void {
			this.preUpdate.emit();

			this._pFrameStats.polygonsCount = 0;
		}

		_updateAutoUpdatedViewports(bUpdateStatistics: boolean = true): void {
			this._pViewportList.forEach((pViewport: IViewport, i) => {
				if (pViewport.isAutoUpdated()) {
					this._updateViewport(pViewport, bUpdateStatistics);
				}
			});
		}

		_endUpdate(): void {
			this.postUpdate.emit();
			this.updateStats();
		}

		_updateViewport(iZIndex: int, bUpdateStatistics?: boolean): void;
		_updateViewport(pViewportPtr: IViewport, bUpdateStatistics?: boolean): void;
		_updateViewport(pViewportPtr: any, bUpdateStatistics: boolean = true): void {
			var pViewport: IViewport;
			var iZIndex: int

			if (isNumber(arguments[0])) {
				iZIndex = <int>arguments[0];
				pViewport = this._pViewportList[iZIndex];

				logger.assert(isDefAndNotNull(pViewport), "No viewport with given z-index : %s", iZIndex,
					"RenderTarget::_updateViewport");
			}
			else {
				pViewport = <IViewport>arguments[0];
			}

			logger.assert(pViewport.getTarget() == this,
				"RenderTarget::_updateViewport the requested viewport is not bound to the rendertarget!");

			this.viewportPreUpdate.emit(pViewport);

			pViewport.update();

			if (bUpdateStatistics) {
				this._pFrameStats.polygonsCount += pViewport._getNumRenderedPolygons();
			}

			this.viewportPostUpdate.emit(pViewport);
		}

		addViewport(pViewport: IViewport): IViewport {
			if (isNull(pViewport)) {
				return null;
			}

			var iZIndex: int = pViewport.getZIndex();

			if (isDefAndNotNull(this._pViewportList[iZIndex])) {
				logger.critical("Can't create another viewport for %s with Z-index %s \
					because a viewport exists with this Z-Order already.", this._sName, iZIndex, "RenderTarget::addViewport");
			}

			pViewport._setTarget(this);

			this._pViewportList[iZIndex] = pViewport;
			this.viewportAdded.emit(pViewport);

			return pViewport;
		}


		removeViewport(iZIndex: int): boolean {
			var pViewport: IViewport = this._pViewportList[iZIndex];

			if (isDefAndNotNull(pViewport)) {
				this.viewportRemoved.emit(pViewport);

				this._pViewportList.splice(iZIndex, 1);
				pViewport = null;

				return true;
			}

			return false;
		}

		removeAllViewports(): uint {
			var pViewport: IViewport;
			var iTotal: uint;

			for (var i in this._pViewportList) {
				pViewport = this._pViewportList[i];
				this.viewportRemoved.emit(pViewport);
			}

			iTotal = this._pViewportList.length;

			(<any>this._pViewportList).clear();

			return iTotal;
		}

		getStatistics(): IFrameStats {
			return this._pFrameStats;
		}

		getLastFPS(): float {
			return this._pFrameStats.fps.last;
		}

		getAverageFPS(): float {
			return this._pFrameStats.fps.avg;
		}

		getBestFPS(): float {
			return this._pFrameStats.fps.best;
		}

		getWorstFPS(): float {
			return this._pFrameStats.fps.worst;
		}

		getPolygonCount(): uint {
			return this._pFrameStats.polygonsCount;
		}

		getBestFrameTime(): float {
			return this._pFrameStats.time.best;
		}

		getWorstFrameTime(): float {
			return this._pFrameStats.time.worst;
		}

		resetStatistics(): void {
			var pStats: IFrameStats = this._pFrameStats;
			pStats.fps.avg = 0.;
			pStats.fps.best = 0.;
			pStats.fps.last = 0.;
			pStats.fps.worst = 999.;

			pStats.polygonsCount = 0;

			pStats.time.best = 9999999;
			pStats.time.worst = 0;

			//FIXME: get right time!!!
			this._fLastTime = this._pRenderer.getEngine().getTime();
			this._fLastSecond = this._fLastTime;
			this._iFrameCount = 0;
		}

		updateStats(): void {
			this._iFrameCount++;

			var fThisTime: float = this._pRenderer.getEngine().getTime();

			var fFrameTime: float = fThisTime - this._fLastTime;

			this._pFrameStats.time.best = math.min(this._pFrameStats.time.best, fFrameTime);
			this._pFrameStats.time.worst = math.min(this._pFrameStats.time.worst, fFrameTime);

			if (fThisTime - this._fLastTime > 1.) {
				this._pFrameStats.fps.last = <float>this._iFrameCount / <float>(fThisTime - this._fLastSecond);

				if (this._pFrameStats.fps.avg == 0.) {
					this._pFrameStats.fps.avg = this._pFrameStats.fps.last;
				}
				else {
					this._pFrameStats.fps.avg = (this._pFrameStats.fps.avg + this._pFrameStats.fps.last) / 2.;

					this._pFrameStats.fps.best = math.max(this._pFrameStats.fps.best, this._pFrameStats.fps.last);
					this._pFrameStats.fps.worst = math.max(this._pFrameStats.fps.worst, this._pFrameStats.fps.last);

					this._fLastSecond = fThisTime;
					this._iFrameCount = 0;
				}

				this._fLastTime = fThisTime;
			}
		}

		getCustomAttribute(sName: string): any {
			return null;
		}

		getViewport(iIndex: uint): IViewport {
			logger.assert(iIndex < this._pViewportList.length, "Index out of bounds");

			for (var i in this._pViewportList) {
				if (iIndex--) {
					continue;
				}

				return this._pViewportList[i];
			}

			return null;
		}

		getViewportByZIndex(iZIndex: int): IViewport {
			var pViewport: IViewport = this._pViewportList[iZIndex];

			logger.assert(isDefAndNotNull(pViewport), "No viewport with given z-index : "
				+ String(iZIndex), "RenderTarget::getViewportByZIndex");

			return pViewport;
		}

		hasViewportByZIndex(iZIndex: int): boolean {
			return isDefAndNotNull(this._pViewportList[iZIndex]);
		}

		isActive(): boolean {
			return this._isActive;
		}

		setActive(bValue: boolean = true): void {
			this._isActive = bValue;
		}

		setAutoUpdated(isAutoUpdate: boolean = true): void {
			this._isAutoUpdate = isAutoUpdate;
		}

		_notifyCameraRemoved(pCamera: ICamera): void {
			var isRemoved: boolean = false;
			for (var i in this._pViewportList) {
				var pViewport: IViewport = this._pViewportList[i];

				if (pViewport.getCamera() === pCamera) {
					pViewport.setCamera(null);
					isRemoved = true;
				}
			}

			if (isRemoved) {
				this.cameraRemoved.emit(pCamera);
			}
		}

		isAutoUpdated(): boolean {
			return this._isAutoUpdate;
		}

		isPrimary(): boolean {
			// RenderWindow will override and return true for the primary window
			return false;
		}

		update(): void {
			this.updateImpl();
		}

		readPixels(ppDest?: IPixelBox, eFramebuffer?: EFramebuffer): IPixelBox {
			return null;
		}


		protected updateImpl(): void {
			this._beginUpdate();
			this._updateAutoUpdatedViewports(true);
			this._endUpdate();
		}

		/* Define the number of priority groups for the render system's render targets. */
		static NUM_RENDERTARGET_GROUPS: uint = 10;
		static DEFAULT_RT_GROUP: uint = 4;
		static REND_TO_TEX_RT_GROUP: uint = 2;
	}
}

