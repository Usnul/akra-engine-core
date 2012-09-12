function AnimationContainer (pAnimation) {
	A_CLASS;


	this._bEnable = true;
	this._fStartTime = 0;
	this._fSpeed = 1.0;
	this._bLoop = false;
	this._pAnimation = null;
	this._bReverse = false;
	
	this._fTrueTime = 0;	//Время учитывающее циклы и прочее.
	this._fRealTime = 0;	//реальное время на сцене
	this._fTime = 0;		//время с учетом ускорений
	this._bPause = false;

	//определена ли анимация до первого и после последнего кадров
	this._bLeftInfinity = true;
	this._bRightInfinity = true;

	if (pAnimation) {
		this.setAnimation(pAnimation);
	}
}

EXTENDS(AnimationContainer, a.AnimationBase);

PROPERTY(AnimationContainer, 'animationName',
	function () {
		return this._pAnimation.name;
	});

PROPERTY(AnimationContainer, 'speed',
	function () {
		return this._fSpeed;
	});

AnimationContainer.prototype.getTime = function () {
    'use strict';
    
	return this._fTime;
};

AnimationContainer.prototype.play = function (fRealTime) {
    'use strict';

    this._fRealTime = fRealTime;
    this._fTime = fRealTime * this._fSpeed;
    //trace('AnimationContainer::play(', this.name, ')', this);
    this.fire('play', this._fTime);
};

AnimationContainer.prototype.stop = function () {
    'use strict';
    
	this.fire('stop', this._fTime);
};

AnimationContainer.prototype.bind = function(pTarget) {
	this._pAnimation.bind(pTarget);
	this.grab(this._pAnimation, true);
};

AnimationContainer.prototype.setAnimation = function (pAnimation) {
    'use strict';

	debug_assert(!this._pAnimation, 'anim. already exists');

	this._pAnimation = pAnimation;
	this.setSpeed(this.speed);
	this.name = 'container-' + pAnimation.name;

	var me = this;
	pAnimation.on('updateDuration', function () {
		me.setSpeed(me.speed);
	});

	this.grab(pAnimation);
};

AnimationContainer.prototype.getAnimation = function () {
    'use strict';
    
	return this._pAnimation;
};

AnimationContainer.prototype.enable = function () {
    'use strict';
    
	this._bEnable = true;
};

AnimationContainer.prototype.disable = function () {
    'use strict';
    
	this._bEnable = false;
};

AnimationContainer.prototype.isEnabled = function () {
    'use strict';
    
	return this._bEnable;
};

AnimationContainer.prototype.leftInfinity = function(bValue) {
	this._bLeftInfinity = bValue;
};

AnimationContainer.prototype.rightInfinity = function(bValue) {
	this._bRightInfinity = bValue;
};

AnimationContainer.prototype.setStartTime = function (fTime) {
    'use strict';

    // var fAcceleration = this._fRealTime ? this._fTime / this._fRealTime:1.;
   	// var fStartTime = fTime * fAcceleration;
   	// this._fTime  = fStartTime;//+= this._fStartTime - fStartTime;
   	//this._fRealTime = fTime;
 //    trace('start time: ', fTime, '/', this._fTime, '-->', this._fStartTime, '/', fStartTime);
	 this._fStartTime = fTime;
};

AnimationContainer.prototype.getStartTime = function () {
    'use strict';
    
	return this._fStartTime;
};

AnimationContainer.prototype.setSpeed = function (fSpeed) {
    'use strict';

	this._fSpeed = fSpeed;
	this._fDuration = this._pAnimation._fDuration / fSpeed;
	
	this.fire('updateDuration');
};

AnimationContainer.prototype.getSpeed = function () {
    'use strict';
    
	return this._fSpeed;
};

AnimationContainer.prototype.useLoop = function (bValue) {
    'use strict';
    
	this._bLoop = bValue;
};

AnimationContainer.prototype.inLoop = function () {
    'use strict';
    
	return this._bLoop;
};

AnimationContainer.prototype.reverse = function(bValue) {
	this._bReverse = bValue;
};

AnimationContainer.prototype.isReversed = function() {
	return this._bReverse;
};

AnimationContainer.prototype.pause = function (bValue) {
    'use strict';
    
	this._bPause = bValue;
};

AnimationContainer.prototype.rewind = function (fRealTime) {
    'use strict';
    //FIXME: нормально реализовать методы rewind & setStartTime();
	//this._fTrueTime = fTrueTime;
	this._fTime = 0;
	this._fRealTime = fRealTime;
};

AnimationContainer.prototype.isPaused = function () {
    'use strict';
    
	return this._bPause;
};

AnimationContainer.prototype.time = function (fRealTime) {
    'use strict';

    if (!this._bPause) {
    	fRealTime -= this._fStartTime;
    	this._fTime = this._fTime + (fRealTime - this._fRealTime) * this._fSpeed;
    }

    this._fRealTime = fRealTime;

    var fTime = this._fTime;

    if (this._bLoop) {
    	fTime = Math.mod(fTime, (this._pAnimation._fDuration));
    	if (this._bReverse) {
    		fTime = this._pAnimation._fDuration - fTime; 
    	}
    }

    this._fTrueTime = fTime;
    
};

AnimationContainer.prototype.frame = function (sName, fRealTime) {
    'use strict';

    if (!this._bEnable) {
    	return null;
    }

    if (this._fRealTime !== fRealTime) {
    	this.time(fRealTime);
    }

    if (!this._bLeftInfinity && this._fTrueTime < this._fStartTime) {
    	return null;
    }

	if (!this._bRightInfinity && this._fTrueTime > this._fDuration) {
    	return null;
    }    

	return this._pAnimation.frame(sName, this._fTrueTime);
};

A_NAMESPACE(AnimationContainer);

