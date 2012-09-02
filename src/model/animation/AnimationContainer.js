function AnimationContainer (pAnimation) {
	A_CLASS;

	//

	// Enum([
	// 	PRIORITY_LOW = 0,
	// 	PRIORITY_HIGH = 1
	// 	], ANIMATION_PRIORITY, a.Animation);

	this._bEnable = true;
	this._fStartTime = 0;
	this._fSpeed = 1.0;
	this._bLoop = false;
	this._pAnimation = null;
	this._fDuration = 0;
	this._bReverse = false;

	if (pAnimation) {
		this.setAnimation(pAnimation);
	}
}

EXTENDS(AnimationContainer, a.AnimationBase);

PROPERTY(AnimationContainer, 'animationName',
	function () {
		return this._pAnimation.name;
	});

AnimationContainer.prototype.setAnimation = function (pAnimation) {
    'use strict';

	debug_assert(!this._pAnimation, 'anim. already exists');

	this._pAnimation = pAnimation;
	this._fDuration = pAnimation._fDuration;
	this.name = 'player[' + pAnimation.name + ']';

	this.grab(pAnimation);
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

AnimationContainer.prototype.setStartTime = function (fTime) {
    'use strict';

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

AnimationContainer.prototype.time = function (fTime) {
    'use strict';
   
	if (!this._bEnable) {
    	return null;
    }

    fTime = (fTime - this._fStartTime) * this._fSpeed;

    if (this._bLoop) {
    	fTime = Math.mod(fTime, (this._pAnimation._fDuration));
    	if (this._bReverse) {
    		fTime = (this._pAnimation._fDuration) - fTime; 
    	}
    }


    return fTime;
};

AnimationContainer.prototype.frame = function (sName, fTime) {
    'use strict';

	return this._pAnimation.frame(sName, this.time(fTime));
};

A_NAMESPACE(AnimationContainer);

