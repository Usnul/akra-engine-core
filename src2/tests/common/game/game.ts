///<reference path="../../../bin/DEBUG/akra.ts"/>
///<reference path="../../../bin/DEBUG/Progress.ts"/>

declare var jQuery: JQueryStatic;
declare var $: JQueryStatic;

#define int number
#define uint number
#define float number
#define double number
#define long number
#define const var

#define vec2(...) Vec2.stackCeil.set(__VA_ARGS__)
#define vec3(...) Vec3.stackCeil.set(__VA_ARGS__)
#define vec4(...) Vec4.stackCeil.set(__VA_ARGS__)
#define quat4(...) Quat4.stackCeil.set(__VA_ARGS__)
#define mat3(...) Mat3.stackCeil.set(__VA_ARGS__)
#define mat4(...) Mat4.stackCeil.set(__VA_ARGS__)

#define DEBUG_TERRAIN 1



module akra {

	#include "IGameTrigger.ts"
	#include "IGameTimeParameters.ts"
	#include "IGamePadParameters.ts"
	#include "IGameHeroParameters.ts"
	#include "IGameCameraParameters.ts"
	#include "IGameTriggersParamerers.ts"
	#include "IGameControls.ts"

	export interface IGameParameters extends 
		IGameTimeParameters, 
		IGamePadParameters, 
		IGameHeroParameters, 
		IGameCameraParameters, 
		IGameTriggersParamerers {
	}
	
	#include "setup.ts"
	#include "createProgress.ts"
	#include "createCameras.ts"
	#include "createSceneEnvironment.ts"
	#include "createViewports.ts"
	#include "createTerrain.ts"
	#include "createSkyBox.ts"
	#include "createSky.ts"
	#include "createModelEntry.ts"
	#include "createModelEx.ts"
	#include "putOnTerrain.ts"
	#include "fetchAllCameras.ts"

	#include "updateKeyboardControls.ts"
	#include "updateCamera.ts"
	#include "virtualGamepad.ts"

	var pProgress: IProgress = createProgress();
	var pGameDeps: IDependens = {
		files: [
			{path: "textures/terrain/main_height_map_1025.dds", name: "TERRAIN_HEIGHT_MAP"},
			{path: "textures/terrain/main_terrain_normal_map.dds", name: "TERRAIN_NORMAL_MAP"},
			{path: "textures/skyboxes/desert-3.dds", name: "SKYBOX"}
		],
		deps: {
			files: [
				{path: "models/barrel/barrel_and_support.dae", name: "BARREL"},
				{path: "models/box/closed_box.dae", name: "CLOSED_BOX"},
				{path: "models/tube/tube.dae", name: "TUBE"},
				{path: "models/tubing/tube_beeween_rocks.DAE", name: "TUBE_BETWEEN_ROCKS"},
				{path: "models/character/charZ.dae", name: "CHARACTER_MODEL"},
				{path: "textures/terrain/diffuse.dds", name: "MEGATEXTURE_MIN_LEVEL"}
			],
			deps: {
				files: [{path: "models/character/all-ih.json", name: "HERO_CONTROLLER"}]
			}
		}
	};

	var pRenderOpts: IRendererOptions = {
		//for screenshoting
		preserveDrawingBuffer: true,
		//for black background & and avoiding composing with other html
		alpha: false,
	};

	
	var pControllerData: IDocument = null;
	var pLoader = {
		changed: (pManager: IDepsManager, pFile: IDep, pInfo: any): void => {
			var sText: string = "";

			if (pFile.status === EDependenceStatuses.LOADING) {
				sText += "Loading ";
			}
			else if (pFile.status === EDependenceStatuses.UNPACKING) {
				sText += "Unpacking ";
			}

			if (pFile.status === EDependenceStatuses.LOADING || pFile.status === EDependenceStatuses.UNPACKING) {
				sText += ("resource " + path.info(path.uri(pFile.path).path).basename);
				
				if (!isNull(pInfo)) {
					sText += " (" + (pInfo.loaded / pInfo.total * 100).toFixed(2) + "%)";
				}

				pProgress.drawText(sText);
			}
			else if (pFile.status === EDependenceStatuses.LOADED) {
				pProgress.total[pFile.deps.depth] = pFile.deps.total;
				pProgress.element = pFile.deps.loaded;
				pProgress.depth = pFile.deps.depth;
				pProgress.draw();

				if (pFile.name === "HERO_CONTROLLER") {
					pControllerData = pFile.content;	
				}
			}
		},
		loaded: (pManager: IDepsManager): void => {
			pProgress.cancel();
			document.body.removeChild(pProgress.canvas);
		}
	};

	var pOptions: IEngineOptions = {
		renderer: pRenderOpts,
		deps: pGameDeps,
		loader: pLoader
	};

	var pEngine: IEngine = createEngine(pOptions);
	
	
	var pUI: IUI 						= pEngine.getSceneManager().createUI();
	var pCanvas: ICanvas3d 				= pEngine.getRenderer().getDefaultCanvas();
	var pCamera: ICamera 				= null;
	var pViewport: IViewport 			= null;
	var pIDE: ui.IDE 					= null;
	var pSkyBoxTexture: ITexture 		= null;
	var pGamepads: IGamepadMap 			= pEngine.getGamepads();
	var pKeymap: controls.KeyMap		= <controls.KeyMap>controls.createKeymap();
	var pTerrain: ITerrain 				= null;
	var pSky: model.Sky  				= null;
	var pMovementController: IAnimationController = null;

	var pRmgr: IResourcePoolManager 	= pEngine.getResourceManager();
	var pScene: IScene3d 				= pEngine.getScene();

	var pTestViewport: IViewport = null;

	export var self = {
		engine 				: pEngine,
		scene 				: pScene,
		camera 				: pCamera,
		viewport 			: pViewport,
		canvas 				: pCanvas,
		rsmgr 				: pRmgr,
		renderer 			: pEngine.getRenderer(),
		keymap 				: pKeymap,
		gamepads 			: pGamepads,
		// cameraTerrainProj 	: <ISceneModel>null,
		terrain 			: <ITerrain>null,
		cameras 			: <ICamera[]>[],
		activeCamera  		: 0,
		cameraLight 		: <ILightPoint>null,
		voice  				: <any>null,
		sky   				: <model.Sky>null,

		hero: {
			root: 	<ISceneNode>null,
			head: 	<ISceneNode>null,
			pelvis: <ISceneNode>null,

			camera: <ICamera>null,
			triggers: <IGameTrigger[]>[],
			controls: <IGameControls> {
		        direct  : {
		            x : 0,
		            y : 0
		        },

		        forward : false,
		        back    : false,
		        right   : false,
		        left    : false,
		        dodge   : false,
		        gun     : false,

		    },

			parameters: <IGameParameters>{
		        analogueButtonThreshold : 0.25,
		        time                    : 0,/*this.fTime*/
		        timeDelta               : 0.,

		        manualSpeedControl	  : false,
		        manualSpeedRate 	  : 0.,

		        movementRate          : 0,
		        movementRateThreshold : 0.0001,
		        movementSpeedMax      : 9.0, /* sec */

		        rotationSpeedMax : 10, /* rad/sec*/
		        rotationRate     : 0, /* current speed*/

		        runSpeed           : 6.0, /* m/sec*/
		        walkToRunSpeed     : 2.5, /* m/sec*/
		        walkSpeed          : 1.8, /* m/sec*/
		        walkbackSpeed      : 1.6, /* m/sec*/
		        walkbackSpeedMin   : 0.5, /* m/sec*/
		        walkWithWeaponSpeed    : 1.4, /* m/sec */
		        walkWithWeaponSpeedMin : 0.75, /* m/sec */
        		walkWithoutWeaponSpeed : 1.8, /* m/sec */

		        movementDerivativeMax   : 1.0,
		        movementDerivativeMin   : 0.5,
		        movementDerivativeConst : (2 * (Math.E + 1) / (Math.E - 1) *
		                                    (1.0 - 0.5)), /*(fSpeedDerivativeMax - fSpeedDerivativeMin)*/

		        walkBackAngleRange : -0.85, /*rad*/

		        //camera parameters
		        cameraPitchChaseSpeed : 10.0, /*rad/sec*/
		        cameraPitchSpeed      : 3.0,
		        cameraPitchMax        : -60.0 * math.RADIAN_RATIO,
		        cameraPitchMin        : +30.0 * math.RADIAN_RATIO, 
		        cameraPitchBase       : Math.PI / 10,

		        //triggers parameters
		        blocked     	: true,
		        lastTriggers 	: 1,

		        //current hero postion
		        position: new Vec3(0.),

		        //camer parameters
		        cameraCharacterDistanceBase       : 5.0, /*метров [расстояние на которое можно убежать от центра камеры]*/
		        cameraCharacterDistanceMax        : 15.0,
		        cameraCharacterChaseSpeed         : 25, /* m/sec*/
		        cameraCharacterChaseRotationSpeed : 5., /* rad/sec*/
		        cameraCharacterFocusPoint         : new Vec3(0.0, 0.5, 0.0), /*meter*/

		        state : EGameHeroStates.WEAPON_NOT_DRAWED,
		        weapon: EGameHeroWeapons.NONE,

		        //harpoon trigger params
		        movementToHarpoonTime   : 1., 		/*sec*/
		        stateToHarpoonTime      : 0.35, 	/*sec*/
		        harpoonIdleToUndrawTime : .15, 		/*sec*/
		        harpoonUndrawToIdleTime : .3, 		/*sec*/
		        harpoonDrawToIdleTime   : .2, 		/*sec*/
		        harpoonToStateTime      : 0.35, 	/*sec*/

				//temp variables for harpoon
		        movementToHarpoonEndTime     : 0.,/*sec [temp/system] DO NOT EDIT!!!*/
		        harpoonDrawStartTime         : 0.,/*sec [temp/system] DO NOT EDIT!!!*/
		        harpoonDrawToIdleStartTime   : 0.,/*sec [temp/system] DO NOT EDIT!!!*/
		        harpoonIdleToUnDrawStartTime : 0.,/*sec [temp/system] DO NOT EDIT!!!*/
		        harpoonUndrawedTime          : 0.,/*sec [temp/system] DO NOT EDIT!!!*/
		        harpoonUndrawStartTime       : 0.,/*sec [temp/system] DO NOT EDIT!!!*/

		        temp: [0., 0., 0., 0.],

		        //gun trigger params
		        movementToGunTime   : 1., 		/*sec*/
		        stateToGunTime      : 0.35, 	/*sec*/
		        gunIdleToUndrawTime : .15, 		/*sec*/
		        gunUndrawToIdleTime : .3, 		/*sec*/
		        gunDrawToIdleTime   : .2, 		/*sec*/
		        gunToStateTime      : 0.35, 	/*sec*/

		        //temp variables for gun
		        movementToGunEndTime     : 0,/*sec [temp/system] DO NOT EDIT!!!*/
		        idleWeightBeforeDraw     : 10,/*sec [temp/system] DO NOT EDIT!!!*/
		        movementWeightBeforeUnDraw     : 10,/*sec [temp/system] DO NOT EDIT!!!*/
		        gunDrawStartTime         : 0,/*sec [temp/system] DO NOT EDIT!!!*/
		        gunDrawToIdleStartTime   : 0,/*sec [temp/system] DO NOT EDIT!!!*/
		        gunIdleToUnDrawStartTime : 0,/*sec [temp/system] DO NOT EDIT!!!*/
		        gunUndrawedTime          : 0,/*sec [temp/system] DO NOT EDIT!!!*/
		        gunUndrawStartTime       : 0,/*sec [temp/system] DO NOT EDIT!!!*/

		        //gund direction beetween top and bottom(across Y-axis)
		        gunDirection			 : 0,

		        //attack state
		        inAttack: false,	

		        //fall params
		        fallDown: false,
		        fallTransSpeed: 0,
		        fallStartTime: 0,

		        anim: <any>{}
		    }
		}
	}

	pKeymap.captureMouse((<webgl.WebGLCanvas>pCanvas).el);
	pKeymap.captureKeyboard(document);


	function initState(pHeroNode: ISceneNode) {
		var pStat = self.hero.parameters;
		var pHeroRoot: ISceneNode = self.hero.root;

		//add animation to common object with fast access by string names
	    function findAnimation(sName: string, sPseudo?: string): any {
	        pStat.anim[sPseudo || sName] = pHeroNode.getController().findAnimation(sName);
	        return pStat.anim[sPseudo || sName];
	    }

	    pStat.time = self.engine.time;
	    pStat.position.set(pHeroRoot.worldPosition);

	    findAnimation("MOVEMENT.player");
	    findAnimation("MOVEMENT.blend");

	    findAnimation('STATE.player');
    	findAnimation('STATE.blend');

	    findAnimation("RUN.player"); 
    	findAnimation("WALK.player");

    	findAnimation("GUN.blend");
    	findAnimation("HARPOON.blend");

    	//harpoon animations
    	var pAnimHarpoonCombo: IAnimationContainer = findAnimation("HARPOON_COMBO.player");
	    var pAnimHarpoonDraw: IAnimationContainer = findAnimation("HARPOON_DRAW.player");
	    var pAnimHarpoonUndraw: IAnimationContainer = findAnimation("HARPOON_UNDRAW.player");

	    //gun animations
	    var pAnimGunDraw: IAnimationContainer = findAnimation("GUN_DRAW.player");
	    var pGunDrawBlend: IAnimationBlend = findAnimation("GUN_DRAW.blend");
	    
	    var pAnimGunUnDraw: IAnimationContainer = findAnimation("GUN_UNDRAW.player");
	    var pGunUnDrawBlend: IAnimationBlend = findAnimation("GUN_UNDRAW.blend")

	    var pAnimGunIdle: IAnimationContainer = findAnimation("GUN_IDLE.player");
	    var pGunIdleBlend: IAnimationBlend = findAnimation("GUN_IDLE.blend");

	    var pAnimGunFire: IAnimationContainer = findAnimation("GUN_FIRE.player");
	    var pGunFireBlend: IAnimationBlend = findAnimation("GUN_FIRE.blend");

	    //right hand for nnode
	    var pGunNode: ISceneNode = <ISceneNode>pHeroRoot.findEntity("node-pistol_in_r_hand");
	    var pRightHolster: ISceneNode = <ISceneNode>pHeroRoot.findEntity("node-Dummy01");
	    var pRightHand: ISceneNode = <ISceneNode>pHeroRoot.findEntity("node-Dummy06");

	    //harpoon.blend
	    //	0 - combo
	    //	1 - idle
	    //	2 - draw
	    //	3 - undraw
	    
	    //gun.blend
	    //	0 - idle
	    //	1 - fire
	    //	2 - draw 
	    //	3 - undraw	
	    	
	    //movement.blend
	    //	0 - run
	    //	1 - walk
	    //	2 - walkback
	    //	3 - gun-walk
	    //	4 - gun-fire
	    //	5 - harpoon-walk
		    	
    	//state.blend
    	// 0 - idle_0
    	// 1 - idle_1
    	// 2 - movement
    	// 3 - gun
    	// 4 - harpoon
     
	    
	    //node with harpoon in right hand
	    var pHarpoonNode: ISceneModel[] = [
	    	(<ISceneModel>pHeroRoot.findEntity("node-Mesh04").child),
	    	(<ISceneModel>pHeroRoot.findEntity("node-Mesh05").child),
	    	(<ISceneModel>pHeroRoot.findEntity("node-Mesh06").child)
	    ];

	    //nodes with harpoon in backpack
	    var pHarpoonBackpackNode: ISceneModel[] = [
	    	(<ISceneModel>pHeroRoot.findEntity("node-Mesh002").child),
	    	(<ISceneModel>pHeroRoot.findEntity("node-Mesh003").child),
	    	(<ISceneModel>pHeroRoot.findEntity("node-Mesh07").child)
	    ];

	    //hide harpoon in right hand
	    pHarpoonNode.forEach((pModel: ISceneModel) => {pModel.visible = false});

	    //disable loops (not nessasary)
		pAnimGunDraw.useLoop(false);
		pAnimGunUnDraw.useLoop(false);
		
		//disable loops (not nessasary)
		pAnimHarpoonDraw.useLoop(false);
		pAnimHarpoonUndraw.useLoop(false);
		pAnimHarpoonCombo.useLoop(false);

		pGunNode.attachToParent(pRightHolster);

		if (isDefAndNotNull(pAnimGunDraw)) {
			var fGunDrawAttachmentTime: float = (15/46) * pAnimGunDraw.duration;

	        pAnimGunDraw.bind("enterFrame", 
	        	(pAnim: IAnimationContainer, fRealTime: float, fTime: float): void => {

	            if (fTime < fGunDrawAttachmentTime) {
	                pGunNode.attachToParent(pRightHolster);
	            }
	            else {
	                pGunNode.attachToParent(pRightHand);
	            }
	        });
	    }

	    if (isDefAndNotNull(pAnimGunUnDraw)) {
	    	var fGunUnDrawAttachmentTime: float = (21/53) * pAnimGunUnDraw.duration;
	        pAnimGunUnDraw.bind("enterFrame", 
	        	(pAnim: IAnimationContainer, fRealTime: float, fTime: float): void => {
	            if (fTime < fGunUnDrawAttachmentTime) {
	                pGunNode.attachToParent(pRightHand);
	            }
	            else {
	                pGunNode.attachToParent(pRightHolster);
	            }
	        });
	    }

	    pAnimGunFire.setSpeed(1.);


	    if (isDefAndNotNull(pAnimGunFire)) {
	    	var fGunFireTime: float = (9/53) * pAnimGunUnDraw.duration;
	        pAnimGunFire.bind("enterFrame", 
	        		(pAnim: IAnimationContainer, fRealTime: float, fTime: float): void => {
	            if (fTime >= fGunFireTime) {
	            	// console.log("fire...");
	            }
	        });
	    }

	    //hide harpoon in backpack and show  harpoon in right hand
	    if (isDefAndNotNull(pAnimHarpoonDraw)) {
	    	var fHarpoonDrawTime: float = (29/75) * pAnimHarpoonDraw.duration;
	        
	        pAnimHarpoonDraw.bind("enterFrame", 
	        	(pAnim: IAnimationContainer, fRealTime: float, fTime: float): void => {

	            if (fTime < fHarpoonDrawTime) {
	            	pHarpoonBackpackNode.forEach((pModel: ISceneModel, i: int) => {
	            		pHarpoonBackpackNode[i].visible = true;
	            		pHarpoonNode[i].visible = false;
	            	});
	            }
	            else {
	            	pHarpoonBackpackNode.forEach((pModel: ISceneModel, i: int) => {
	            		pHarpoonBackpackNode[i].visible = false;
	            		pHarpoonNode[i].visible = true;
	            	});
	            }
	        });
	    }

	    //hide harpoon in right hand and show backpack harpoon
	    if (isDefAndNotNull(pAnimHarpoonUndraw)) {
	    	var fHarpoonUndrawTime: float = (44/70) * pAnimHarpoonUndraw.duration;
	        
	        pAnimHarpoonUndraw.bind("enterFrame", 
	        	(pAnim: IAnimationContainer, fRealTime: float, fTime: float): void => {

	            if (fTime < fHarpoonUndrawTime) {
	            	pHarpoonBackpackNode.forEach((pModel: ISceneModel, i: int) => {
	            		pHarpoonBackpackNode[i].visible = false;
	            		pHarpoonNode[i].visible = true;
	            	});
	            }
	            else {
	            	pHarpoonBackpackNode.forEach((pModel: ISceneModel, i: int) => {
	            		pHarpoonBackpackNode[i].visible = true;
	            		pHarpoonNode[i].visible = false;
	            	});
	            }
	        });
	    }

	    /* 
	    	run, 
	    	walk, 
	    	walkback, 
	    	weapon_walk,
	    	gun-fire
	    	harpoon-walk
	    */
	   
	    findAnimation('MOVEMENT.blend').setWeights(0., 1., 0., 0., 0., 0.);
	    /*
	    	idle_0, 
	    	idle_1, 
	    	movement, 
	    	gun,
	    	harpoon
	     */
	    findAnimation('STATE.blend').setWeights(1., 0., 0., 0., 0.); 

	    activateTrigger([moveHero, movementHero, checkHeroState]);
	}


	function updateCharacterCamera(pControls: IGameControls, pHero: ISceneNode, pStat: IGameParameters, pController: IAnimationController) {
	    var pCamera: ICamera = self.hero.camera;
	    var fTimeDelta: float = pStat.timeDelta;
	    var pGamepad: Gamepad = self.gamepads.find(0) || virtualGamepad(pKeymap);

	    if (!pGamepad || !pCamera.isActive()) {
	        return;
	    }

	    var fX: float = -pGamepad.axes[EGamepadAxis.RIGHT_ANALOGUE_HOR];
	    var fY: float = -pGamepad.axes[EGamepadAxis.RIGHT_ANALOGUE_VERT];

	    if (math.abs(fX) < pStat.analogueButtonThreshold) {
	        fX = 0;
	    }

	    if (math.abs(fY) < pStat.analogueButtonThreshold) {
	        fY = 0;
	    }

	    // var pCameraWorldData: Float32Array = pCamera.worldMatrix.data;

	    var v3fHeroFocusPoint: IVec3 = pStat.cameraCharacterFocusPoint.add(self.hero.pelvis.worldPosition, vec3());
	   	var v3fCameraHeroDist: IVec3;
	    

	    // camera orientation
	    
	   	var v3fCameraYPR: IVec3 = pCamera.localOrientation.toYawPitchRoll(vec3());
	    var fPitchRotation: float = 0;
	    var qPitchRot: IQuat4;
	    var fYawRotation: float = 0;
	    var qYawRot: IQuat4;


	    /* 
	       Pitch
	             | -90(-PI/2)
	    	 0   |
	       --|-- +
	    	/ \  |
                 | +90(+PI/2)
	     */
	    
	    // console.log(pStat.cameraPitchMax * math.DEGREE_RATIO, "<", v3fCameraYPR.y * math.DEGREE_RATIO, "<", pStat.cameraPitchMin * math.DEGREE_RATIO, fY, (v3fCameraYPR.y > pStat.cameraPitchMax && fY > 0));
		
		if ((v3fCameraYPR.y > pStat.cameraPitchMax && fY > 0) ||
	        (v3fCameraYPR.y < pStat.cameraPitchMin && fY < 0)) 
	 	{
			fPitchRotation = fY * pStat.cameraPitchSpeed * fTimeDelta;
	 		
		    var pCameraWorldData: Float32Array = pCamera.worldMatrix.data;
		    var v3fCameraDir: IVec3 = vec3(-pCameraWorldData[__13], 0, -pCameraWorldData[__33]).normalize();
		    var v3fCameraOrtho: IVec3 = vec3(v3fCameraDir.z, 0, -v3fCameraDir.x);
		    qPitchRot = Quat4.fromAxisAngle(v3fCameraOrtho, fPitchRotation, quat4());
	    
	        v3fCameraHeroDist = pCamera.worldPosition.subtract(v3fHeroFocusPoint, vec3());
		    pCamera.localPosition = qPitchRot.multiplyVec3(v3fCameraHeroDist, vec3()).add(v3fHeroFocusPoint);
		    pCamera.update();

	        // pCamera.localPosition.scale(1. + fY / 25);
	        pCamera.update();
	    }
	    
	   	fYawRotation = fX * pStat.cameraPitchChaseSpeed * fTimeDelta;
	    qYawRot = Quat4.fromYawPitchRoll(fYawRotation, 0, 0., quat4());
	   

	    v3fCameraHeroDist = pCamera.worldPosition.subtract(v3fHeroFocusPoint, vec3());
	    pCamera.localPosition = qYawRot.multiplyVec3(v3fCameraHeroDist, vec3()).add(v3fHeroFocusPoint);
	    pCamera.update();

	     //camera position
	    var fCharChaseSpeedDelta: float = (pStat.cameraCharacterChaseSpeed * fTimeDelta);
	    
	    var fCameraHeroDist: float = v3fCameraHeroDist.length();
	    var fDist: float = 
	    (fCameraHeroDist - pStat.cameraCharacterDistanceBase) / pStat.cameraCharacterDistanceMax * fCharChaseSpeedDelta;

	    var v3fHeroZX: IVec3 = vec3(v3fHeroFocusPoint);
	    v3fHeroZX.y = 0.0;
	    
	    var v3fCameraZX: IVec3 = vec3(pCamera.worldPosition);
	    v3fCameraZX.y = 0.0;

	    //направление в плоскости XZ от камеры к персонажу(фокус поинту)
	    var v3fHorDist: IVec3 = v3fHeroZX.subtract(v3fCameraZX, vec3());
	    var v3fDir: IVec3 = v3fHorDist.normalize(vec3());
	    
	    if (v3fHorDist.length() > 2.0 || fDist <= 0) {
			pCamera.addPosition(v3fDir.scale(fDist));
		}

		//настигаем нужную высоту
		var fDeltaHeight: float = (v3fHeroFocusPoint.y + math.sin(pStat.cameraPitchBase) * fCameraHeroDist - pCamera.worldPosition.y);
		pCamera.addPosition(vec3(0., (fDeltaHeight * fCharChaseSpeedDelta * math.abs(fDeltaHeight / 100)), 0.));
		    
		pCamera.update();


	    if (!isNull(pTerrain)) {
	    	var v3fDt: IVec3 = vec3(0.);

    		pTerrain.projectPoint(pCamera.worldPosition, v3fDt);
    		
    		v3fDt.x = pCamera.worldPosition.x;
    		v3fDt.y = math.max(v3fDt.y + 1.0, pCamera.worldPosition.y);
    		v3fDt.z = pCamera.worldPosition.z;

    		pCamera.setPosition(v3fDt);
    	}

		// pCamera.update();

	    //camera orientation
 
	    var qCamera: IQuat4 = Quat4.fromYawPitchRoll(v3fCameraYPR.x + fYawRotation, v3fCameraYPR.y/* + fPitchRotation*/, v3fCameraYPR.z);
	    var qHeroView: IQuat4 = Mat4.lookAt(pCamera.worldPosition, 
	    							v3fHeroFocusPoint, 
	    							vec3(0., 1., 0.),
	                                mat4()).toQuat4(quat4());

	    qCamera.smix(qHeroView.conjugate(), pStat.cameraCharacterChaseRotationSpeed * fTimeDelta);

	    pCamera.localOrientation = qCamera;
	    pCamera.update();
	    //====================
	    

	    //pStat.cameraPitchChaseSpeed
	    //-pStat.cameraPitchBase
	    //-pStat.cameraPitchMin
	    //-pStat.cameraPitchMax
	    //pStat.cameraPitchSpeed

	    
	}

	function fireInWalk(pControls: IGameControls, pHero: ISceneNode, pStat: IGameParameters, pController: IAnimationController) {
		var pAnim: IAnimationMap = pStat.anim;
		var pMovementBlend: IAnimationBlend = <IAnimationBlend>pAnim["MOVEMENT.blend"];
		var pFirePlayer: IAnimationContainer = <IAnimationContainer>pAnim["GUN_FIRE.player"];
		var fTimeDelta: float = pStat.timeDelta;

		const iFireAnim: int = 4;
        const iTotalFireAnimWeight: int = 100;
		
		var iWeight: int = pMovementBlend.getAnimationWeight(iFireAnim);
        
        if (inAttack(pControls)) {	
        	if (iWeight == 0) {
        		console.log("fire player > rewind && pause");
        		pFirePlayer.rewind(0.);
        		pFirePlayer.pause(true);
        	}

        	var iSpeed: int = 3.;

        	if (iWeight > 1.) iSpeed = 10.;

        	if (iWeight < iTotalFireAnimWeight) {
        		iWeight += iSpeed * fTimeDelta;
        	}

        	iWeight = math.clamp(iWeight, 0., iTotalFireAnimWeight);

        	if (iWeight > 10. && pFirePlayer.isPaused()) {
        		pFirePlayer.pause(false);
        	}

        	//добавляем выстрелы
        	pMovementBlend.setAnimationWeight(iFireAnim, iWeight);
        }
        else {
        	var fK: float = (1. - pFirePlayer.animationTime / pFirePlayer.duration);
    		
    		if (fK > iWeight) {
    			pMovementBlend.setAnimationWeight(iFireAnim, 0);	
    		}
    		else {
    			pMovementBlend.setAnimationWeight(iFireAnim, fK);	
    		}
        }
	}

	function movementHero(pControls: IGameControls, pHero: ISceneNode, pStat: IGameParameters, pController: IAnimationController) {
	    var pAnim: IAnimationMap = pStat.anim;

	    var pMovementPlayer: IAnimationContainer = <IAnimationContainer>pAnim["MOVEMENT.player"];
	    var pMovementBlend: IAnimationBlend = <IAnimationBlend>pAnim["MOVEMENT.blend"];
	    var pWalkPlayer: IAnimationContainer = <IAnimationContainer>pAnim["WALK.player"];
	    var pRunPlayer: IAnimationContainer = <IAnimationContainer>pAnim["RUN.player"];
	    var pStateBlend: IAnimationBlend = <IAnimationBlend>pAnim["STATE.blend"];

	    var fMovementRate: float = pStat.movementRate;
	    var fMovementRateAbs: float = math.abs(fMovementRate);

	    var fRunSpeed: float = pStat.runSpeed;
	    var fWalkToRunSpeed: float = pStat.walkToRunSpeed;

	    var fWalkSpeed: float = determWalkSpeed(pStat);
	    var fMinSpeed: float = determMinSpeed(pStat);
	    var fMaxSpeed: float = determMaxSpeed(pStat);

	    var fSpeed: float;

	    var fRunWeight: float;
	    var fWalkWeight: float;

	    fSpeed = fMovementRateAbs * fMaxSpeed;

	    if (pController.active) {
		    if (pController.active.name !== "STATE.player") {
		        pController.play('STATE.player');
		    }
	    }
	    else {
	    	console.warn("controller::active is null ;(");
	    }

	    //character move
	    if (fSpeed > fMinSpeed) {
	    	var iWEAPON: int = isGun(pStat) ? 3: 4;

	        if (pMovementPlayer.isPaused()) {
	            pMovementPlayer.pause(false);
	        }
	        
	        //зануляем IDLE'ы чтобы избежать проблем с тазом
	        pStateBlend.setWeights(0., 0., 1., 0.);

	        if (fMovementRate > 0.0) {
	            //run forward
	            if (fSpeed < fWalkToRunSpeed || hasWeapon(pStat)) {
	                if (hasWeapon(pStat)) {
	                	if (isGun(pStat)) {
	                    	pMovementBlend.setWeights(0., 0., 0., 1., 0.); /*only walk*/
							fireInWalk(pControls, pHero, pStat, pController);
	                	}

	                	if (isHarpoon(pStat)) {
	                		pMovementBlend.setWeights(0., 0., 0., 0., 0., 1.); /*only walk*/
	                	}
	                }
	                else {
	                    pMovementBlend.setWeights(0., 1., 0., 0., 0.); /* only walk */
	                }

	                pWalkPlayer.setSpeed(fSpeed / fWalkSpeed);
	            }	
	            else {
	            	pWalkPlayer.setSpeed(1.);

	                fRunWeight = (fSpeed - fWalkToRunSpeed) / (fRunSpeed - fWalkToRunSpeed);
	                fWalkWeight = 1. - fRunWeight;
	                //run //walk frw //walk back
	                
	                pMovementBlend.setWeights(fRunWeight, fWalkWeight, 0., 0., 0.);
	                pMovementPlayer.setSpeed(1.);
	            }
	        }
	        else {
	            //walkback
	            pMovementBlend.setWeights(0., 0., 1., 0., 0.);
	            pMovementPlayer.setSpeed(fMovementRateAbs);
	        }
	    }
	    //character IDLE
	    else {
	    	pMovementPlayer.pause(true);
	    	//pMovementPlayer.rewind(0);

	        var iWEAPON: int = isGun(pStat) ? 3: 4;
	        var iIDLE: int = hasWeapon(pStat) ? iWEAPON : 0.;
	        var iMOVEMENT: int = 2;

	        if ((!hasWeapon(pStat) || pStat.state == EGameHeroStates.WEAPON_IDLE)) {
	            pStateBlend.setWeightSwitching(fSpeed / fMinSpeed, iIDLE, iMOVEMENT); /* idle ---> run */
	        }

	        if (fMovementRate > 0.0) {
	            //walk forward --> idle
	            if (hasWeapon(pStat)) {
	            	if (isGun(pStat))
	                	pMovementBlend.setWeights(0., 0., 0., fSpeed / fMinSpeed, 0., 0.);

	                if (isHarpoon(pStat)) 
	                	pMovementBlend.setWeights(0., 0., 0., 0., 0., fSpeed / fMinSpeed);
	            }
	            else {
	                pMovementBlend.setWeights(0., fSpeed / fMinSpeed, 0., 0., 0., 0., 0.);
	            }
	        }
	        else if (fMovementRate < 0.0) {
	            //walk back --> idle
	            pMovementBlend.setWeights(0., 0, fSpeed / fMinSpeed, 0., 0., 0.);
	        }

	        pMovementPlayer.setSpeed(1);
	    }

	    // if (pController.dodge) {
	    //     this.activateTrigger([this.dodgeHero, this.moveHero]);
	    // }
	}

	inline function inAttack(pControls: IGameControls): bool {
		return pControls.fire > 0.2;
	}

	inline function hasWeapon(pStat: IGameParameters): bool {
		return pStat.weapon != EGameHeroWeapons.NONE;
	}

	function checkHeroState(pControls, pHero, pStat, pController) {
	    if (pControls.gun) {
	        activateTrigger([gunWeaponHero, moveHero]);
	    }
	    else if (pControls.harpoon) {
	    	activateTrigger([harpoonWeaponHero, moveHero]);
	    }
	}

	function determWalkSpeed(pStat: IGameParameters): float {
		return pStat.movementRate > 0.0? 
			(!hasWeapon(pStat)? pStat.walkWithoutWeaponSpeed: pStat.walkWithWeaponSpeed): 
			pStat.walkbackSpeed;
	}

	function determMaxSpeed(pStat: IGameParameters): float {
		return pStat.movementRate > 0.0? 
			(!hasWeapon(pStat)? pStat.runSpeed: pStat.walkWithWeaponSpeed): 
			pStat.walkbackSpeed;
	}

	function determMinSpeed(pStat: IGameParameters): float {
		return pStat.movementRate > 0.0? 
			(!hasWeapon(pStat)? pStat.walkWithoutWeaponSpeed: pStat.walkWithWeaponSpeedMin): 
			pStat.walkbackSpeedMin;
	}

	inline function isGun(pStat): bool {
		return pStat.weapon === EGameHeroWeapons.GUN;
	}

	inline function isHarpoon(pStat): bool {
		return pStat.weapon === EGameHeroWeapons.HARPOON;
	}

	inline function disableMovement(pControls: IGameControls): void {
		pControls.direct.x = pControls.direct.y = 0.;
	}

	function harpoonWeaponHero (pControls: IGameControls, pHero: ISceneNode, pStat: IGameParameters, pController: IAnimationController) {
		// console.log((<IAnimationBlend>pStat.anim["STATE.blend"]).getAnimationWeight(3.), "gun weight << ");
	    var pAnim: IAnimationMap = pStat.anim;

	    var fMovementRate: float = pStat.movementRate;
	    var fMovementRateAbs: float = math.abs(fMovementRate);

	    var fWalkSpeed: float = determWalkSpeed(pStat);
	    var fMinSpeed: float = determMinSpeed(pStat);
	    var fMaxSpeed: float = determMaxSpeed(pStat);

	    var fSpeed: float = fMaxSpeed * fMovementRateAbs;
	    var fDelta: float;

	    var pHarpoonDrawPlayer: IAnimationContainer = <IAnimationContainer>pAnim['HARPOON_DRAW.player'];
	    var pHarpoonUnDrawPlayer: IAnimationContainer = <IAnimationContainer>pAnim['HARPOON_UNDRAW.player'];
	    var pHarpoonIdlePlayer: IAnimationContainer = <IAnimationContainer>pAnim['HARPOON_IDLE.player'];
	    var pHarpoonComboPlayer: IAnimationContainer = <IAnimationContainer>pAnim['HARPOON_COMBO.player'];
	    var pHarpoonBlend: IAnimationBlend = <IAnimationBlend>pAnim['HARPOON.blend'];

	    var pStateBlend: IAnimationBlend = <IAnimationBlend>pAnim['STATE.blend'];

	    var pMovementBlend: IAnimationBlend = <IAnimationBlend>pAnim["MOVEMENT.blend"];
	   	var pWalkPlayer: IAnimationContainer = <IAnimationContainer>pAnim["WALK.player"];
	    var pRunPlayer: IAnimationContainer = <IAnimationContainer>pAnim["RUN.player"];

	    var fNow: float = now() / 1000;

	    if (isFirstFrameOfTrigger()) {
	    	pStat.weapon = EGameHeroWeapons.HARPOON;

	        //переводим персонажа в состоянии убранного гарпуна
	        //имеенно в это состояние мы будем переходим, при условии, что у нас нету гарпуна
	        pHarpoonDrawPlayer.rewind(0.);
	        pHarpoonDrawPlayer.pause(true);

	        /*combo, idle, draw, undraw*/
	        pHarpoonBlend.setWeights(0., 0., 1., 0.); 
	    }

	    if (pStat.state !== EGameHeroStates.WEAPON_IDLE) {
	        disableMovement(pControls);
	    }

	    if (pStat.state == EGameHeroStates.WEAPON_NOT_DRAWED && fSpeed < 0.5) {
	        pStat.state = EGameHeroStates.HARPOON_BEFORE_DRAW;
	        //с этого времени стало понятно, что надо достать гарпун
	        pStat.movementToHarpoonEndTime = fNow;
	        //необходимо для перехода в состояние с оружием, надо быстро 
	        //перевести персонажа state::IDLE --> state::HARPOON
	        //за время stat.stateToHarpoonTime(sec.)
	        pStat.idleWeightBeforeDraw = pStateBlend.getAnimationWeight(0);
	    }

	    //переводим персонажа в состояние state::HARPOON при условии, что 
	    //его скорость меньше скорости хотьбы, это важно, так как во всех остальных случаях
	    //мы зануляем controls.direct.x = controls.direct.y = 0, принуждая его остановиться
	    if (fSpeed < fMinSpeed) {
	        //время с момента, как стало ясно, что надо доставать гарпун
	        fDelta = fNow - pStat.movementToHarpoonEndTime;

	        if (fDelta <= pStat.stateToHarpoonTime) {
	        	//вес state::HARPOON
	        	var fK: float = fDelta / pStat.stateToHarpoonTime;
	        	//вес state::IDLE
	        	var fkInv: float = 1. - fK;
	            pStateBlend.setWeights(pStat.idleWeightBeforeDraw * fkInv, null, null, null, fK);
	        }
	    }

	    if (pStat.state == EGameHeroStates.HARPOON_BEFORE_DRAW) {
	    	//с этого момента, должна начать играться анимация доставания питолета
	        pHarpoonDrawPlayer.pause(false);
	        pStat.state = EGameHeroStates.HARPOON_DRAWING;
	        pStat.harpoonDrawStartTime = fNow;
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_DRAWING) {
	        fDelta = fNow - pStat.harpoonDrawStartTime;

	        if (fDelta >= pHarpoonBlend.duration) {
	            pStat.state = EGameHeroStates.HARPOON_DRAWED;
	            pStat.harpoonDrawToIdleStartTime = fNow;
	        }
	    }
	    
	    if (pStat.state == EGameHeroStates.HARPOON_DRAWED) {
	        fDelta = fNow - pStat.harpoonDrawToIdleStartTime;

	        if (fDelta <= pStat.harpoonDrawToIdleTime) {
	        	//переходим от harpoon::DRAW --> harpoon::IDLE
	            pHarpoonBlend.setWeightSwitching(fDelta / pStat.harpoonDrawToIdleTime, 2, 1);
	        }
	        else {
	            pStat.state = EGameHeroStates.WEAPON_IDLE;
	            pHarpoonBlend.setWeights(0., 1., 0., 0.);
	            pStateBlend.setWeights(0., 0., 0., 0., 1.);
	        }
	    }
	    else if (pStat.state == EGameHeroStates.WEAPON_IDLE) {

	    	if (inAttack(pControls) && !pStat.inAttack) {
	    		pStat.inAttack = true;
	    		pStat.state = EGameHeroStates.HARPOON_BEFORE_ATTACK;

	    		pHarpoonComboPlayer.pause(true);
	    		pHarpoonComboPlayer.rewind(0.);

	    		pStat.temp[0] = fNow;
	    		pStat.temp[1] = pHarpoonBlend.getAnimationWeight(1.);
	    	}
	    	
	    	// if (pStat.inAttack && !inAttack(pControls)) {
	    	// 	var fK: float = (1. - pHarpoonComboPlayer.animationTime / pHarpoonComboPlayer.duration);
	    	// 	if (fK > pHarpoonBlend.getAnimationWeight(0)) {
	    	// 		pHarpoonBlend.setAnimationWeight(0, 0);	
	    	// 		pStat.inAttack = false;
	    	// 	}
	    	// 	else {
	    	// 		pHarpoonBlend.setAnimationWeight(0, fK);	
	    	// 	}
	    	// }

	        if (pControls.harpoon) { 
	            pHarpoonUnDrawPlayer.rewind(0.);
	            pHarpoonUnDrawPlayer.pause(true);

	            pStat.harpoonIdleToUnDrawStartTime = fNow;
				pStat.movementWeightBeforeUnDraw = pStateBlend.getAnimationWeight(2.);
	            pStat.state = EGameHeroStates.HARPOON_BEFORE_UNDRAW;
	        }
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_BEFORE_ATTACK) {
	    	fDelta = fNow - pStat.temp[0];
	    	if (fDelta <= pStat.harpoonIdleToUndrawTime) {
	        	//переходим из harpoon::IDLE --> harpoon::COMBO
	            pHarpoonBlend.setWeightSwitching(fDelta / pStat.harpoonIdleToUndrawTime, 1, 0);
	        }
	        else {
	        	pHarpoonBlend.setWeights(1., 0., 0., 0.);
	        	pHarpoonComboPlayer.pause(false);
	        	pStat.state = EGameHeroStates.HARPOON_ATTACKING;
	        }	
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_ATTACKING) {
	    	//in attacking
	    	pStat.manualSpeedControl = true;
	    	pStat.manualSpeedRate = 1.5 / 1.4;
	    	var iJumpTime: number = 70 / 125 * pHarpoonComboPlayer.duration;

	    	if (pHarpoonComboPlayer.animationTime >= iJumpTime) {

	    	}

	    	//attack finished
	    	if (pHarpoonComboPlayer.animationTime >= pHarpoonComboPlayer.duration) {
	    		pStat.manualSpeedRate = 0.;
	    		pStat.state = EGameHeroStates.HARPOON_ATTACK_FINISHED;
	    		pStat.temp[0] = fNow;
	    	}
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_ATTACK_FINISHED) {
	    	fDelta = fNow - pStat.temp[0];
	    	if (fDelta <= pStat.harpoonIdleToUndrawTime) {
	    		pStat.manualSpeedControl = false;
	        	//переходим из harpoon::IDLE --> harpoon::COMBO
	            pHarpoonBlend.setWeightSwitching(fDelta / pStat.harpoonIdleToUndrawTime, 0, 1);
	        }
	        else {
	        	pHarpoonBlend.setWeights(0., 1., 0., 0.);
	        	pStat.state = EGameHeroStates.WEAPON_IDLE;
	        	pStat.inAttack = false;
	        }	
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_BEFORE_UNDRAW) {
	        fDelta = fNow - pStat.harpoonIdleToUnDrawStartTime;
	        if (fDelta <= pStat.harpoonIdleToUndrawTime) {
	        	var fK: float = fDelta / pStat.harpoonIdleToUndrawTime;
	            pStateBlend.setWeights(pStat.movementWeightBeforeUnDraw * (1. - fK), null, null, 0., fK);

	        	//переходим из harpoon::IDLE --> harpoon.UNDRAW
	            pHarpoonBlend.setWeightSwitching(fDelta / pStat.harpoonIdleToUndrawTime, 1, 3);
	        }
	        else {
	        	/* idle_0, idle_1, movement, gun, harpoon */
	        	pStateBlend.setWeights(0., 0., 0., 0., 1.);
	        	//undraw only!
	        	pHarpoonBlend.setWeights(0., 0., 0., 1.);

	            pStat.harpoonUndrawStartTime = fNow;
	            pStat.state = EGameHeroStates.HARPOON_UNDRAWING;

	            pHarpoonUnDrawPlayer.pause(false);
	        }
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_UNDRAWING) {
	        fDelta = fNow - pStat.harpoonUndrawStartTime;

	        if (fDelta >= pHarpoonBlend.duration) {
	            pStat.state = EGameHeroStates.HARPOON_UNDRAWED;
	            pStat.harpoonUndrawedTime = fNow;
	        }
	    }
	    else if (pStat.state == EGameHeroStates.HARPOON_UNDRAWED) {
	        fDelta = fNow - pStat.harpoonUndrawedTime;
	        if (fDelta <= pStat.harpoonUndrawToIdleTime) {
	        	//переходим из state::HARPOON --> state.IDLE
	        	console.log("переходим из state::HARPOON --> state.IDLE");
	            pStateBlend.setWeightSwitching(fDelta / pStat.harpoonUndrawToIdleTime, 4, 0);
	        }
	        else {
	        	console.log("EGameHeroStates.HARPOON_UNDRAWED finished!");

	        	pStateBlend.setWeights(1., 0., 0., 0., 0.);
	        	pMovementBlend.setWeights(0., 1., 0., 0., 0.);
	        	
	        	pRunPlayer.rewind(0.);
	        	pWalkPlayer.rewind(0.);
	        	pRunPlayer.setSpeed(1.);
	        	pWalkPlayer.setSpeed(1.);
	        	pRunPlayer.pause(false);
	        	pWalkPlayer.pause(false);

	            pStat.state = EGameHeroStates.WEAPON_NOT_DRAWED;
	           	pStat.weapon = EGameHeroWeapons.NONE;
	            deactivateTrigger();
	        }
	    }

	    if (pStat.state < EGameHeroStates.HARPOON_BEFORE_UNDRAW)
	    	movementHero(pControls, pHero, pStat, pController);
	};

	function gunWeaponHero (pControls: IGameControls, pHero: ISceneNode, pStat: IGameParameters, pController: IAnimationController
		/*, fTriggerTime*/) {
	    var pAnim: IAnimationMap = pStat.anim;

	    var fMovementRate: float = pStat.movementRate;
	    var fMovementRateAbs: float = math.abs(fMovementRate);

	    var fRunSpeed: float = pStat.runSpeed;
	    var fWalkToRunSpeed: float = pStat.walkToRunSpeed;

	    var fWalkSpeed: float = determWalkSpeed(pStat);
	    var fMinSpeed: float = determMinSpeed(pStat);
	    var fMaxSpeed: float = determMaxSpeed(pStat);

	    var fSpeed: float = fMaxSpeed * fMovementRateAbs;

	    var fDelta: float;

	    var pGunDrawAnim: IAnimationContainer = <IAnimationContainer>pAnim['GUN_DRAW.player'];
	    var pGunDrawBlend: IAnimationBlend = <IAnimationBlend>pAnim['GUN_DRAW.blend'];

	    var pGunUnDrawAnim: IAnimationContainer = <IAnimationContainer>pAnim['GUN_UNDRAW.player'];
	    var pGunUnDrawBlend: IAnimationBlend = <IAnimationBlend>pAnim['GUN_UNDRAW.blend'];

	    var pGunIdleAnim: IAnimationContainer = <IAnimationContainer>pAnim['GUN_IDLE.player'];
	    var pGunIdleBlend: IAnimationBlend = <IAnimationBlend>pAnim['GUN_IDLE.blend'];

	    var pGunBlend: IAnimationBlend = <IAnimationBlend>pAnim['GUN.blend'];
	    var pStateBlend: IAnimationBlend = <IAnimationBlend>pAnim['STATE.blend'];
	    var pFireBlend: IAnimationBlend = <IAnimationBlend>pAnim['GUN_FIRE.blend'];
	    var pFirePlayer: IAnimationContainer = <IAnimationContainer>pAnim['GUN_FIRE.player'];

	    var pMovementBlend: IAnimationBlend = <IAnimationBlend>pAnim["MOVEMENT.blend"];
	   	var pWalkPlayer: IAnimationContainer = <IAnimationContainer>pAnim["WALK.player"];
	    var pRunPlayer: IAnimationContainer = <IAnimationContainer>pAnim["RUN.player"];

	    var fNow: float = now() / 1000;

	    if (pControls.forward && pStat.gunDirection < 1.) {
	    	pStat.gunDirection += 0.05;
	    }

	    if (pControls.back && pStat.gunDirection > -1.) {
	    	pStat.gunDirection -= 0.05;
	    }

	    //положение пистолета(куда направлен, вверх или вниз)
	    var fGd: float = math.clamp(pStat.gunDirection, -1, 1);
	    //веса верхнего, прямого и нижнего положений
        var fGKup: float = math.max(fGd, 0.);
        var fGKfrw: float = (1. - math.abs(fGd));
        var fGKdown: float = math.abs(math.min(fGd, 0));

		
		var isOK = true;


	    if (isFirstFrameOfTrigger()) {
	    	pStat.weapon = EGameHeroWeapons.GUN;
	        //переводим персонажа в состоянии убранного пистолета
	        //имеенно в это состояние мы будем переходим, при условии, что у нас нету пистолета
	        pGunDrawAnim.rewind(0.);
	        pGunDrawAnim.pause(true);

	        pGunBlend.setWeights(0., 0., 1., 0.); /*idle, fire, draw, undraw*/
	    }

	    if (pStat.state !== EGameHeroStates.WEAPON_IDLE) {
	        pControls.direct.x = pControls.direct.y = 0.;
	    }

	    if (pStat.state == EGameHeroStates.WEAPON_NOT_DRAWED && fSpeed < 0.5) {
	        console.log('getting gun...');

	        pStat.state = EGameHeroStates.GUN_BEFORE_DRAW;
	        //с этого времени стало понятно, что надо достать пистолет
	        pStat.movementToGunEndTime = fNow;
	        //необходимо для перехода в состояние с оружием, надо быстро 
	        //перевести персонажа state::IDLE --> state::GUN
	        //за время stat.stateToGunTime(sec.)
	        pStat.idleWeightBeforeDraw = pStateBlend.getAnimationWeight(0);
	    }

	    //переводим персонажа в состояние state::GUN при условии, что 
	    //его скорость меньше скорости хотьбы, это важно, так как во всех остальных случаях
	    //мы зануляем controls.direct.x = controls.direct.y = 0, принуждая его остановиться
	    if (fSpeed < fMinSpeed) {
	        //время с момента, как стало ясно, что надо доставать пистолет
	        fDelta = fNow - pStat.movementToGunEndTime;

	        if (fDelta <= pStat.stateToGunTime) {
	        	//вес state::GUN
	        	var fK: float = fDelta / pStat.stateToGunTime;
	        	//вес state::IDLE
	        	var fkInv: float = 1. - fK;
	        	console.log("state::IDLE --> state::GUN (" + fK + ")");
	            pStateBlend.setWeights(pStat.idleWeightBeforeDraw * fkInv, null, null, fK);
	        }
	    }

	    if (pStat.state == EGameHeroStates.GUN_BEFORE_DRAW) {
	    	//с этого момента, должна начать играться анимация доставания питолета
	        pGunDrawAnim.pause(false);
	        pStat.state = EGameHeroStates.GUN_DRAWING;
	        pStat.gunDrawStartTime = fNow;

	        // pStateBlend.setWeights(0., 0., 0., 1.);
	    }
	    else if (pStat.state == EGameHeroStates.GUN_DRAWING) {
	    	//во время доставания пистолета, можно целиться
	    	pGunDrawBlend.setWeights(fGKup, fGKfrw, fGKdown);

	        fDelta = fNow - pStat.gunDrawStartTime;

	        if (fDelta >= pGunBlend.duration) {
	            // console.log('go to idle with gun..');

	            pStat.state = EGameHeroStates.GUN_DRAWED;
	            pStat.gunDrawToIdleStartTime = fNow;
	            //оставляем только IDLE, для упрощения вычислений
	        }
	    }
	    
	    if (pStat.state == EGameHeroStates.GUN_DRAWED) {
	        fDelta = fNow - pStat.gunDrawToIdleStartTime;

	        pGunIdleBlend.setWeights(fGKup, fGKfrw, fGKdown);

	        if (fDelta <= pStat.gunDrawToIdleTime) {
	        	//переходим от gun::DRAW --> gun::IDLE
	            pGunBlend.setWeightSwitching(fDelta / pStat.gunDrawToIdleTime, 2, 0);
	        }
	        else {
	            pStat.state = EGameHeroStates.WEAPON_IDLE;
	            pGunBlend.setWeights(1., 0., 0., 0.);

	            // console.log('only idle with gun..');
	            //idle --> 0
	            // pStateBlend.setAnimationWeight(0, 0);
	        }
	    }
	    
	    else if (pStat.state == EGameHeroStates.WEAPON_IDLE) {
	    	pGunIdleBlend.setWeights(fGKup, fGKfrw, fGKdown);

	    	if (pControls.fire > 0.20 && !pStat.inAttack) {
	    		pStat.inAttack = true;
	    		pFirePlayer.rewind(0.);
		    	pGunBlend.setAnimationWeight(1, pControls.fire * 100);
	    	}
	    	
	    	if (pStat.inAttack && pControls.fire < 0.20) {
	    		var fK: float = (1. - pFirePlayer.animationTime / pFirePlayer.duration);
	    		if (fK > pGunBlend.getAnimationWeight(1)) {
	    			pGunBlend.setAnimationWeight(1, 0);	
	    			console.log("end of fire anim");
	    			pStat.inAttack = false;
	    		}
	    		else {
	    			pGunBlend.setAnimationWeight(1, fK);	
	    		}
	    	}

	    	if (pStat.inAttack) {
	    		pFireBlend.setWeights(fGKup, fGKfrw, fGKdown);
	    	}

	        if (pControls.gun) { 
	        	//undraw gun
	            //pStat.state
	            // console.log('before gun undrawing...');

	            pGunUnDrawAnim.rewind(0.);
	            pGunUnDrawAnim.pause(true);

	            pGunUnDrawBlend.setWeights(fGKup, fGKfrw, fGKdown);

	            pStat.gunIdleToUnDrawStartTime = fNow;
				pStat.movementWeightBeforeUnDraw = pStateBlend.getAnimationWeight(2.);
	            pStat.state = EGameHeroStates.GUN_BEFORE_UNDRAW;

	        }
	    }
	    
	    else if (pStat.state == EGameHeroStates.GUN_BEFORE_UNDRAW) {
	        fDelta = fNow - pStat.gunIdleToUnDrawStartTime;
	        if (fDelta <= pStat.gunIdleToUndrawTime) {
	        	var fK: float = fDelta / pStat.gunIdleToUndrawTime;
	            pStateBlend.setWeights(pStat.movementWeightBeforeUnDraw * (1. - fK), null, null, fK);

	        	//переходим из gun::IDLE --> gun.UNDRAW
	            pGunBlend.setWeightSwitching(fDelta / pStat.gunIdleToUndrawTime, 2, 3);
	        }
	        else {
	        	pStateBlend.setWeights(0., 0., 0., 1.);
	        	pGunBlend.setWeights(0., 0., 0., 1.);

	            pStat.gunUndrawStartTime = fNow;
	            pStat.state = EGameHeroStates.GUN_UNDRAWING;

	            pGunUnDrawAnim.pause(false);

	            // console.log('go to gun undrawning....');
	        }
	    }
	    else if (pStat.state == EGameHeroStates.GUN_UNDRAWING) {
	        fDelta = fNow - pStat.gunUndrawStartTime;

	        pGunUnDrawBlend.setWeights(fGKup, fGKfrw, fGKdown);

	        if (fDelta >= pGunBlend.duration) {
	            // console.log('gun undrawed.');
	            pStat.state = EGameHeroStates.GUN_UNDRAWED;
	            pStat.gunUndrawedTime = fNow;
	        }
	    }
	    

	    else if (pStat.state == EGameHeroStates.GUN_UNDRAWED) {
	        fDelta = fNow - pStat.gunUndrawedTime;

	        if (fDelta <= pStat.gunUndrawToIdleTime) {
	        	//переходим из state::GUN --> state.IDLE
	            pStateBlend.setWeightSwitching(fDelta / pStat.gunUndrawToIdleTime, 3, 0);
	        }
	        else {
	        	pStateBlend.setWeights(1.0, 0., 0., 0.);
	        	pMovementBlend.setWeights(0., 1., 0., 0., 0.);
	        	
	        	pRunPlayer.rewind(0.);
	        	pWalkPlayer.rewind(0.);
	        	pRunPlayer.setSpeed(1.);
	        	pWalkPlayer.setSpeed(1.);
	        	pRunPlayer.pause(false);
	        	pWalkPlayer.pause(false);

	            pStat.state = EGameHeroStates.WEAPON_NOT_DRAWED;
	           	pStat.weapon = EGameHeroWeapons.NONE;
	            deactivateTrigger();

	            // console.log("deactivateTrigger();");
	        }
	    }

	    if (pStat.state < EGameHeroStates.GUN_BEFORE_UNDRAW)
	    	movementHero(pControls, pHero, pStat, pController);
	};


	inline function isFirstFrameOfTrigger(): bool {
	    return self.hero.parameters.lastTriggers !== self.hero.triggers.length;
	};

	inline function isSpeedControlEnabled(pStat: IGameHeroParameters): bool {
		return pStat.manualSpeedControl;
	}

	function moveHero(pControls: IGameControls, pHero: ISceneNode, pStat: IGameParameters, pController: IAnimationController): void {
	    var fMovementRate: float;
	    var fMovementSpeedMax: float;

	    var fTimeDelta: float;
	    var fDirectX: float, fDirectY: float;
	    var fMovementDerivative: float;
	    var fMovementDerivativeMax: float;
	    var fRotationRate: float = 0;

	    var fMovementRateAbs: float;
	    var fWalkRate: float;
	    var f: float;

	    var pCamera: ICamera, pCameraWorldData: Float32Array;
	    var v3fCameraDir: IVec3, v3fCameraOrtho: IVec3;
	    var fCameraYaw: float;

	    var pHeroWorldData: Float32Array;
	    var v3fHeroDir: IVec3;

	    var v2fStick: IVec2;
	    var fScalar: float;
	    var fPower: float;
	    var v2fStickDir: IVec2;

	    var v3fRealDir: IVec3;

	    var fMovementDot: float;
	    var fMovementTest: float;
	    var fMovementDir: float;

	    //analogue stick values
	    fDirectY = pControls.direct.y;
	    fDirectX = -pControls.direct.x;

	    //camera data
	    pCamera = self.hero.camera;
	    pCameraWorldData = pCamera.worldMatrix.data;

	    //camera view direction projection to XZ axis
	    v3fCameraDir = vec3(-pCameraWorldData[__13], 0., -pCameraWorldData[__33]).normalize();
	    //v3fCameraOrtho  = Vec3(v3fCameraDir.z, 0., -v3fCameraDir.x);

	    //hero directiob proj to XZ axis
	    pHeroWorldData = pHero.worldMatrix.data;
	    v3fHeroDir = vec3(pHeroWorldData[__13], 0., pHeroWorldData[__33]).normalize();

	    //stick data
	    v2fStick = vec2(fDirectX, fDirectY);

	    //calculating stick power
	    if (v2fStick.x == v2fStick.y && v2fStick.x == 0.) {
	        fScalar = 0.;
	    }
	    else if (math.abs(v2fStick.x) > math.abs(v2fStick.y)) {
	        fScalar = math.sqrt(1. + math.pow(v2fStick.y / v2fStick.x, 2.));
	    }
	    else {
	        fScalar = math.sqrt(math.pow(v2fStick.x / v2fStick.y, 2.) + 1.);
	    }

	    //stick power value
	    fPower = fScalar ? v2fStick.length() / fScalar : 0.;
	    //stick dir
	    v2fStickDir = v2fStick.normalize(vec2());

	    //camera yaw
	    fCameraYaw = -math.atan2(v3fCameraDir.z, v3fCameraDir.x);

	    //real direction in hero-space
	    v3fRealDir = vec3(v2fStickDir.y, 0., v2fStickDir.x);
	    Quat4.fromYawPitchRoll(fCameraYaw, 0., 0., quat4()).multiplyVec3(v3fRealDir);


	    //movement parameters
	    fMovementDot = v3fRealDir.dot(v3fHeroDir);
	    fMovementTest = math.abs(fMovementDot - 1.) / 2.;
	    fMovementDir = 1.;

	    fMovementRate = fPower * math.sign(fMovementDot);

	    if (fMovementDot > pStat.walkBackAngleRange) {
	        fMovementDir = v3fRealDir.x * v3fHeroDir.z - v3fRealDir.z * v3fHeroDir.x;
	        fRotationRate = fPower * math.sign(fMovementDir) * fMovementTest;
	    }
	    else {
	        fRotationRate = 0.0;
	    }

	    fTimeDelta = pEngine.time - pStat.time;
	    fMovementSpeedMax = determMaxSpeed(pStat);
	    fWalkRate = determMinSpeed(pStat) / fMovementSpeedMax;

	    if (fTimeDelta != 0.0) {
	        fMovementDerivative = (fMovementRate - pStat.movementRate) / fTimeDelta;
	        f = math.exp(math.abs(pStat.movementRate));
	        fMovementDerivativeMax = pStat.movementDerivativeMin + ((f - 1.) / (f + 1.)) * pStat.movementDerivativeConst;
	        fMovementRate = pStat.movementRate +
	                        fTimeDelta * math.clamp(fMovementDerivative, -fMovementDerivativeMax, fMovementDerivativeMax);
	    }

	    //use manual speed
	    if (isSpeedControlEnabled(pStat)) {
	    	fMovementRate = pStat.manualSpeedRate;
	    }
	    
	    fMovementRateAbs = math.abs(fMovementRate);
		

	    if (fMovementRateAbs < pStat.movementRateThreshold) {
	        fMovementRate = 0.;
	    }

	    if (fRotationRate != 0.) {
	        pHero.addRelRotationByEulerAngles(fRotationRate * pStat.rotationSpeedMax * fTimeDelta, 0.0, 0.0);
	    }

	    if (pStat.fallDown || fMovementRateAbs >= fWalkRate/* ||
	        (fMovementRate < 0. && fMovementRateAbs > pStat.walkSpeed / pStat.runSpeed)*/) {

	    	//projection of the hero on the terrin
	    	var v3fHeroTerrainProjPoint: IVec3 = vec3(0.);
	    	//prev. hero position
	    	var v3fHeroPos: IVec3 = vec3(pHero.worldPosition);

	    	var fMovementSpeed: float = fMovementRate * fMovementSpeedMax;

	    	if (pStat.fallDown) {
	    		fMovementSpeed = pStat.fallTransSpeed;
	    	}

	    	//hero orinted along Z-axis
	    	pHero.addRelPosition(vec3(0.0, 0.0, fMovementSpeed * fTimeDelta));
	    	pHero.update();

	    	if (!isNull(pTerrain)) {
	    		pTerrain.projectPoint(pHero.worldPosition, v3fHeroTerrainProjPoint);

	    		if (v3fHeroPos.y - v3fHeroTerrainProjPoint.y > 0.1) {
	    			
	    			if (pStat.fallDown == false) {
		    			pStat.fallDown = true;
		    			pStat.fallTransSpeed = fMovementSpeed;
		    			pStat.fallStartTime = now();
	    			}

	    			var fFallSpeed: float = ((now() - pStat.fallStartTime) / 1000) * math.GRAVITY_CONSTANT;
	    			pHero.setPosition(pHero.worldPosition.x, pHero.worldPosition.y - fFallSpeed * fTimeDelta, pHero.worldPosition.z);
	    		}
	    		else {
	    			pStat.fallDown = false;
	    			pHero.setPosition(v3fHeroTerrainProjPoint);
	    		}
	    	}

	        //console.log((fMovementRate * fMovementSpeedMax).toFixed(2) + " m/sec");
	    }

	    pStat.rotationRate = fRotationRate;
	    pStat.movementRate = fMovementRate;
	    pStat.time = pEngine.time;
	    pStat.timeDelta = fTimeDelta;
	};

	function activateTrigger(pTriggersList: Function[]): void {
	    pTriggersList.push(updateCharacterCamera);
	    self.hero.triggers.push({triggers : pTriggersList, time : pEngine.time});
	};

	function deactivateTrigger(): IGameTrigger {
	    return self.hero.triggers.pop();
	};

	enum EDisplayModes {
		WIREFRAME,
		COLORED,
		COLORED_WIREFRAME,
		TEXTURE
	};

	var iSWTimer: int = -1;
	var eMode: EDisplayModes = EDisplayModes.WIREFRAME;
	function switchDisplayMode(): void {
		switch (eMode) {
			case EDisplayModes.WIREFRAME:
				pEngine.getComposer()["bShowTriangles"] = true;
				pTerrain.megaTexture["_bColored"] = false;
				pTerrain.showMegaTexture = false;
				break;
			case EDisplayModes.COLORED:
				pEngine.getComposer()["bShowTriangles"] = false;
				pTerrain.megaTexture["_bColored"] = true;
				pTerrain.showMegaTexture = true;
				break;
			case EDisplayModes.COLORED_WIREFRAME:
				pEngine.getComposer()["bShowTriangles"] = true;
				pTerrain.megaTexture["_bColored"] = true;
				pTerrain.showMegaTexture = true;
				break;
			case EDisplayModes.TEXTURE:
				pEngine.getComposer()["bShowTriangles"] = false;
				pTerrain.megaTexture["_bColored"] = false;
				pTerrain.showMegaTexture = true;
				break;
		}
		
		if (eMode == EDisplayModes.TEXTURE) {
			eMode = EDisplayModes.WIREFRAME;
		}
		else {
			eMode ++;
		}
	}

	function updateHero (): void {
	    var pGamepad: Gamepad = self.gamepads.find(0) || virtualGamepad(pKeymap);
	    var pHero: ISceneNode = self.hero.root;
	    var pStat: IGameParameters = self.hero.parameters;
	    var pController: IAnimationController = self.hero.root.getController();
	    
	    var pTriggers: IGameTrigger	  = self.hero.triggers.last;
	    var pControls: IGameControls  = self.hero.controls;
	    var pTriggersData: Function[] = pTriggers.triggers;

	    if (pGamepad.buttons[EGamepadCodes.SELECT]) {
	        pStat.blocked = true;
	    }
	    if (pGamepad.buttons[EGamepadCodes.START]) {
	        pStat.blocked = false;
	    }
	    if (pStat.blocked) {
	        return;
	    }

	    var fDirectY: float = -pGamepad.axes[EGamepadAxis.LEFT_ANALOGUE_VERT];
	    var fDirectX: float = -pGamepad.axes[EGamepadAxis.LEFT_ANALOGUE_HOR];

	    var fAnalogueButtonThresholdInv: float = 1. - pStat.analogueButtonThreshold;

	    if (math.abs(fDirectX) < pStat.analogueButtonThreshold) {
	        fDirectX = 0.;
	    }
	    else {
	        fDirectX = math.sign(fDirectX) * (math.abs(fDirectX) - pStat.analogueButtonThreshold) /
	                   fAnalogueButtonThresholdInv;
	    }
	    if (math.abs(fDirectY) < pStat.analogueButtonThreshold) {
	        fDirectY = 0.;
	    }
	    else {
	        fDirectY = math.sign(fDirectY) * (math.abs(fDirectY) - pStat.analogueButtonThreshold) /
	                   fAnalogueButtonThresholdInv;
	    }

	    pControls.direct.y = fDirectY;
	    pControls.direct.x = fDirectX;

	    pControls.forward = !!pGamepad.buttons[EGamepadCodes.PAD_TOP];
	    pControls.back = !!pGamepad.buttons[EGamepadCodes.PAD_BOTTOM];
	    pControls.left = !!pGamepad.buttons[EGamepadCodes.PAD_LEFT];
	    pControls.right = !!pGamepad.buttons[EGamepadCodes.PAD_RIGHT];

	    pControls.dodge = !!pGamepad.buttons[EGamepadCodes.FACE_1];
	    pControls.gun = !!pGamepad.buttons[EGamepadCodes.FACE_4];
	    pControls.harpoon = !!pGamepad.buttons[EGamepadCodes.FACE_3];

	    pControls.fire = pGamepad.buttons[EGamepadCodes.RIGHT_SHOULDER_BOTTOM];

	    if (pGamepad.buttons[EGamepadCodes.LEFT_SHOULDER_BOTTOM] > 0.5) {
	    	if (iSWTimer == -1) {
	    		iSWTimer = setTimeout(() => {
	    			iSWTimer = -1;
	    			switchDisplayMode();
	    		}, 200);
	    	}
	    }

	    var iTrigger: uint = self.hero.triggers.length;

	    for (var i: int = 0; i < pTriggersData.length; ++i) {
	        pTriggersData[i](pControls, pHero, pStat, pController, pTriggers.time);
	    }

	    pStat.lastTriggers = iTrigger;
	}

	function updateCameraAxes(): void {
	    // var pCameraWorldData = this.getActiveCamera().worldMatrix().pData;
	    // var v3fCameraDir = Vec3(-pCameraWorldData._13, 0, -pCameraWorldData._33).normalize();

	    // this.pCameraBasis.setRotation(Vec3(0, 1, 0), -Math.atan2(v3fCameraDir.z, v3fCameraDir.x));
	}

	function setupCameras(pHeroNode: ISceneNode): void {
		self.hero.root = pHeroNode;

		var pCharacterCamera: ICamera = pScene.createCamera("character-camera");
	    var pCharacterRoot: ISceneNode = self.hero.root;
	    var pCharacterPelvis: ISceneNode = <ISceneNode>pCharacterRoot.findEntity("node-Bip001");
	    var pCharacterHead: ISceneNode = <ISceneNode>pCharacterRoot.findEntity("node-Bip001_Head");

	    pCharacterCamera.setInheritance(ENodeInheritance.NONE);
	    pCharacterCamera.attachToParent(pCharacterRoot);
	    pCharacterCamera.setProjParams(Math.PI / 4.0, pCanvas.width / pCanvas.height, 0.1, 3000.0);
	    pCharacterCamera.setRelPosition(vec3(0, 2.5, -5));

	    self.hero.camera = pCharacterCamera;
	    self.hero.head = pCharacterHead;
	    self.hero.pelvis = pCharacterPelvis;
	}

	//>>>>>>>>>>>>>>>>>>>>>

	function isDefaultCamera(pViewport: IViewport, pKeymap: IKeyMap, pCamera: ICamera, pCharacterCamera: ICamera, pGamepad: Gamepad): bool {

		if (pKeymap.isKeyPress(EKeyCodes.N1) ||
	        (pGamepad && pGamepad.buttons[EGamepadCodes.RIGHT_SHOULDER])) {
	        pCharacterCamera.lookAt(self.hero.head.worldPosition);
	        pViewport.setCamera(pCharacterCamera);
	    }
	    else if (pKeymap.isKeyPress(EKeyCodes.N2) ||
	             (pGamepad && pGamepad.buttons[EGamepadCodes.LEFT_SHOULDER])) {
	        pViewport.setCamera(pCamera);
	    }

	    if (pCharacterCamera.isActive()) {
	        return false;
	    }

	    return true;
	}

	function edgeDetection(pViewport: IDSViewport): any {
		pViewport.effect.addComponent("akra.system.edgeDetection", 2, 0);
		pViewport.view.getTechnique()._setGlobalPostEffectsFrom(2);

		var pParams = {
			lineWidth: 2.0,
			threshold: 0.2
		};

		pViewport.bind("render", (
			pViewport: IDSViewport, 
			pTechnique: IRenderTechnique, 
			iPass: int, 
			pRenderable: IRenderableObject, 
			pSceneObject: ISceneObject): void => {

			var pPass: IRenderPass = pTechnique.getPass(iPass);
			
			switch (iPass) {
				case 2:
					pPass.setUniform("EDGE_DETECTION_THRESHOLD", pParams.threshold);
					pPass.setUniform("EDGE_DETECTION_LINEWIDTH", pParams.lineWidth);
			}
		});

		return pParams;
	}

	function motionBlur(pViewport: IDSViewport): void {
		var pPrevViewMat: IMat4 = new Mat4(1.);
		var pCamera: ICamera = pViewport.getCamera();
		
		pViewport.effect.addComponent("akra.system.motionBlur", 2, 0);
		pViewport.view.getTechnique()._setGlobalPostEffectsFrom(2);

		setInterval(() => {
			pPrevViewMat.set(pCamera.viewMatrix);
		}, 10);

		pViewport.bind("render", (
			pViewport: IDSViewport, 
			pTechnique: IRenderTechnique, 
			iPass: int, 
			pRenderable: IRenderableObject, 
			pSceneObject: ISceneObject): void => {

			var pPass: IRenderPass = pTechnique.getPass(iPass);
			var pDepthTex: ITexture = pViewport.depth;
			var pCamera: ICamera = pViewport.getCamera();
			// console.log(pCamera.isWorldMatrixNew());
			switch (iPass) {
				case 2:
					pCamera.update();
				    pPass.setUniform("SCREEN_TEXTURE_RATIO",
                        vec2(pViewport.actualWidth / pDepthTex.width, pViewport.actualHeight / pDepthTex.height));
				    
					pPass.setTexture("SCENE_DEPTH_TEXTURE", pDepthTex);
					pPass.setUniform("PREV_VIEW_MATRIX", pPrevViewMat);
					// pPass.setUniform("CURR_INV_VIEW_CAMERA_MAT", pCamera.worldMatrix);
					// pPass.setUniform("CURR_PROJ_MATRIX", pCamera.projectionMatrix);
					// pPass.setUniform("CURR_VIEW_MATRIX", t2);
			}
		});
	}


	function update(): void {
		var pCharacterCamera: ICamera = self.hero.camera;
		var pGamepad: Gamepad = pGamepads.find(0) || virtualGamepad(pKeymap);

		if (isDefaultCamera(pViewport, pKeymap, pCamera, pCharacterCamera, pGamepad)) {
			updateCamera(pCamera, pKeymap, pGamepad);
		}

		updateHero();
		self.keymap.update();
	}

	function createModels(): void {
		var pImporter = new io.Importer(pEngine);
		pImporter.loadDocument(pControllerData);
		pMovementController = pImporter.getController();

		var pHeroNode: ISceneNode = <ISceneNode>createModelEx("CHARACTER_MODEL", pScene, pTerrain, pCamera, pMovementController);
		setupCameras(pHeroNode);
		initState(pHeroNode);

		var pBox: ISceneNode = createModelEntry(pScene, "CLOSED_BOX");

		pBox.scale(.25);
		putOnTerrain(pBox, pTerrain, new Vec3(-2., -3.85, -5.));
		pBox.addPosition(new Vec3(0., 1., 0.));

		var pBarrel: ISceneNode = createModelEntry(pScene, "BARREL");

		pBarrel.scale(.75);
		pBarrel.setPosition(new Vec3(-30., -40.23, -15.00));
		pBarrel.setRotationByXYZAxis(-17. * math.RADIAN_RATIO, -8. * math.RADIAN_RATIO, -15. * math.RADIAN_RATIO);
		

		var pTube: ISceneNode = createModelEntry(pScene, "TUBE");

		pTube.scale(19.);
		pTube.setRotationByXYZAxis(0. * math.RADIAN_RATIO, -55. * math.RADIAN_RATIO, 0.);
		pTube.setPosition(new Vec3(-16.  , -52.17  ,-66.));
		

		var pTubeBetweenRocks: ISceneNode = createModelEntry(pScene, "TUBE_BETWEEN_ROCKS");
	
		pTubeBetweenRocks.scale(2.);
		pTubeBetweenRocks.setRotationByXYZAxis(5. * math.RADIAN_RATIO, 100. * math.RADIAN_RATIO, 0.);
		pTubeBetweenRocks.setPosition(new Vec3(-55., -12.15, -82.00));
		
		

		pScene.bind("beforeUpdate", update);
		
		self.cameras = fetchAllCameras(pScene);
		self.activeCamera = self.cameras.indexOf(self.camera);
	}

	function main(pEngine: IEngine): void {
		setup(pCanvas, pUI);

		pCamera 		= self.camera 	= createCameras(pScene);
		pViewport 						= createViewports(new render.DSViewport(pCamera), pCanvas, pUI);
		pTerrain 		= self.terrain 	= createTerrain(pScene, true);
										  createModels();
		pSkyBoxTexture 					= createSkyBox(pRmgr, <IDSViewport>pViewport);
		pSky 			= self.sky 		= createSky(pScene, 14.);

		//test viewports
		// var pTestViewport = pCanvas.addViewport(new render.DSViewport(pCamera, .25, .25, .5, .5, 1.));
		var pTex: ITexture = <ITexture>pViewport["_pDeferredColorTextures"][0];
		var pColorViewport: render.TextureViewport = <any>pCanvas.addViewport(new render.TextureViewport(pTex, 0.05, 0.05, .30, .30, 4.));
		var pNormalViewport: render.TextureViewport = <any>pCanvas.addViewport(new render.TextureViewport(pTex, 0.05, 0.40, .30, .30, 5.));

		function onResize(pViewport: IViewport) {
			pColorViewport.setMapping(0., 0., pViewport.actualWidth / pTex.width, pViewport.actualHeight / pTex.height));
			pNormalViewport.setMapping(0., 0., pViewport.actualWidth / pTex.width, pViewport.actualHeight / pTex.height));
		}

		onResize();
		
		pViewport.bind("viewportDimensionsChanged", onResize);

		pColorViewport.effect.addComponent("akra.system.display_consistent_colors");
		pNormalViewport.effect.addComponent("akra.system.display_normals");
		//end of test

		var pProject: ILightPoint = pScene.createLightPoint(ELightTypes.PROJECT, true, 512);
			
		pProject.attachToParent(pScene.getRootNode());
		pProject.enabled = false;
		
		var pParams = <any>pProject.params;

		pParams.ambient.set(0.0, 0.0, 0.0, 1);
		pParams.diffuse.set(1.);
		pParams.specular.set(1.);
		pParams.attenuation.set(0.5, 0, 0);


		pProject.setPosition(new Vec3(-300, 300, -300));
		pProject.lookAt(new Vec3(0., .0, 0.));	

		pProject.lightingDistance = 10000.;

		pKeymap.bind("equalsign", () => {
			self.activeCamera ++;
	    	
	    	if (self.activeCamera === self.cameras.length) {
	    		self.activeCamera = 0;
	    	}

	    	var pCam: ICamera = self.cameras[self.activeCamera];
	    	
	    	pViewport.setCamera(pCam);
		});

		pKeymap.bind("M", () => {
			pEngine.getComposer()["bShowTriangles"] = !pEngine.getComposer()["bShowTriangles"];
		});

		pKeymap.bind("N", () => {
			if (pTerrain.megaTexture)
				pTerrain.megaTexture["_bColored"] = !pTerrain.megaTexture["_bColored"];
		});

		// (<any>sefl).edgeDetection = edgeDetection(<IDSViewport>pViewport);
		// motionBlur(<IDSViewport>pViewport);

		createSceneEnvironment(pScene, true, true);
#if DEBUG_TERRAIN == 1
		pEngine.getComposer()["bShowTriangles"] = true;
		if (pTerrain.megaTexture)
			pTerrain.megaTexture["_bColored"] = true;
#endif
		pEngine.exec();
	}

	pEngine.bind("depsLoaded", main);	
}
