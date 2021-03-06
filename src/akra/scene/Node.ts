/// <reference path="../idl/INode.ts" />
/// <reference path="../util/Entity.ts" />
/// <reference path="../math/math.ts" />
/// <reference path="../bf/bf.ts" />

module akra.scene {

	export enum ENodeUpdateFlags {
		k_SetForDestruction = 0,
		//if changed scale, otation or position
		k_NewOrientation,
		// k_NewTranslation,
		// k_NewScale,
		k_NewWorldMatrix,
		k_NewLocalMatrix,
		k_RebuildInverseWorldMatrix,
		k_RebuildNormalMatrix,
	}

	import __11 = math.__11;
	import __12 = math.__12;
	import __13 = math.__13;
	import __14 = math.__14;

	import __21 = math.__21;
	import __22 = math.__22;
	import __23 = math.__23;
	import __24 = math.__24;

	import __31 = math.__31;
	import __32 = math.__32;
	import __33 = math.__33;
	import __34 = math.__34;

	import __41 = math.__41;
	import __42 = math.__42;
	import __43 = math.__43;
	import __44 = math.__44;

	import Mat4 = math.Mat4;
	import Vec3 = math.Vec3;
	import Quat4 = math.Quat4;
	import Mat3 = math.Mat3;
	import Vec4 = math.Vec4;

	export class Node extends util.Entity implements INode {
		protected _m4fLocalMatrix: IMat4 = null;
		protected _m4fWorldMatrix: IMat4 = null;
		protected _m4fInverseWorldMatrix: IMat4 = null;
		protected _m3fNormalMatrix: IMat3 = null;

		protected _v3fWorldPosition: IVec3 = null;

		protected _qRotation: IQuat4 = null;
		protected _v3fTranslation: IVec3 = null;
		protected _v3fScale: IVec3 = null;

		protected _iUpdateFlags: int = 0;
		protected _eInheritance: ENodeInheritance = ENodeInheritance.POSITION;

		create(): boolean {
			return true;
		}

		getLocalOrientation(): IQuat4 {
			return this._qRotation;
		}

		setLocalOrientation(qOrient: IQuat4): INode {
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			this._qRotation.set(qOrient);
			return this;
		}

		getLocalPosition(): IVec3 {
			return this._v3fTranslation;
		}

		setLocalPosition(v3fPosition: IVec3): INode {
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			this._v3fTranslation.set(v3fPosition);
			return this;
		}

		getLocalScale(): IVec3 {
			return this._v3fScale;
		}

		setLocalScale(v3fScale: IVec3): INode {
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			this._v3fScale.set(v3fScale);
			return this;
		}

		getLocalMatrix(): IMat4 {
			return this._m4fLocalMatrix;
		}

		setLocalMatrix(m4fLocalMatrix: IMat4): INode {
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewLocalMatrix);
			this._m4fLocalMatrix.set(m4fLocalMatrix);
			return this;
		}


		getWorldMatrix(): IMat4 {
			return this._m4fWorldMatrix;
		}

		getWorldPosition(): IVec3 {
			return this._v3fWorldPosition;
		}

		getWorldOrientation(): IQuat4 {
			//TODO: calc right world orient.
			return null;
		}

		getWorldScale(): IVec3 {
			//TODO: calc right world scale.
			return this.getLocalScale();
		}

		//  get worldRotation(): IQuat4 {
		// 	logger.assert((<Node>this._pParent).worldMatrix.toMat3(Node._m3fTemp1).decompose(Node._q4fTemp1, Node._v3fTemp1), 
		//             		"could not decompose.");
		// 	//FIXME: use correct way to get world rotation
		// 	return Node._q4fTemp1;
		// }

		getInverseWorldMatrix(): IMat4 {
			if (bf.testBit(this._iUpdateFlags, ENodeUpdateFlags.k_RebuildInverseWorldMatrix)) {
				this._m4fWorldMatrix.inverse(this._m4fInverseWorldMatrix);
				this._iUpdateFlags = bf.clearBit(this._iUpdateFlags, ENodeUpdateFlags.k_RebuildInverseWorldMatrix);
			}

			return this._m4fInverseWorldMatrix;
		}

		getNormalMatrix(): IMat3 {
			if (bf.testBit(this._iUpdateFlags, ENodeUpdateFlags.k_RebuildNormalMatrix)) {

				this._m4fWorldMatrix.toMat3(this._m3fNormalMatrix).inverse().transpose();

				this._iUpdateFlags = bf.clearBit(this._iUpdateFlags, ENodeUpdateFlags.k_RebuildNormalMatrix);
			}

			return this._m3fNormalMatrix;
		}

		getVectorUp(): IVec3 {
			var vec = this._m4fWorldMatrix.multiplyVec4(math.Vec4.temp(0.,1.,0.,0.));
			return new math.Vec3(vec.x,vec.y,vec.z);
		}

		getVectorRight(): IVec3 {
			var vec = this._m4fWorldMatrix.multiplyVec4(math.Vec4.temp(-1.,0.,0.,0.));
			return new math.Vec3(vec.x,vec.y,vec.z);
		}

		getVectorForward(): IVec3 {
			var vec = this._m4fWorldMatrix.multiplyVec4(math.Vec4.temp(0.,0.,1.,0.));
			return new math.Vec3(vec.x,vec.y,vec.z);
		}

		getTempVectorUp(): IVec3 {
			var vec = this._m4fWorldMatrix.multiplyVec4(math.Vec4.temp(0.,1.,0.,0.));
			return math.Vec3.temp(vec.x,vec.y,vec.z);
		}

		getTempVectorRight(): IVec3 {
			var vec = this._m4fWorldMatrix.multiplyVec4(math.Vec4.temp(-1.,0.,0.,0.));
			return math.Vec3.temp(vec.x,vec.y,vec.z);
		}

		getTempVectorForward(): IVec3 {
			var vec = this._m4fWorldMatrix.multiplyVec4(math.Vec4.temp(0.,0.,1.,0.));
			return math.Vec3.temp(vec.x,vec.y,vec.z);
		}

		update(): boolean {
			// derived classes update the local matrix
			// then call this base function to complete
			// the update
			return this.recalcWorldMatrix();
		}


		prepareForUpdate(): void {
			super.prepareForUpdate();
			// clear the temporary flags
			this._iUpdateFlags = bf.clearAll(this._iUpdateFlags, bf.flag(ENodeUpdateFlags.k_NewLocalMatrix) |
				bf.flag(ENodeUpdateFlags.k_NewOrientation) | bf.flag(ENodeUpdateFlags.k_NewWorldMatrix));
		}


		setInheritance(eInheritance: ENodeInheritance) {
			this._eInheritance = eInheritance;
		}

		getInheritance(): ENodeInheritance {
			return this._eInheritance;
		}

		isWorldMatrixNew(): boolean {
			return bf.testBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewWorldMatrix);
		}

		isLocalMatrixNew(): boolean {
			return bf.testBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewLocalMatrix);
		}

		private recalcWorldMatrix(): boolean {
			var isParentMoved: boolean = this._pParent && (<Node>this._pParent).isWorldMatrixNew();
			var isOrientModified: boolean = bf.testBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			var isLocalModified: boolean = bf.testBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewLocalMatrix);

			if (isOrientModified || isParentMoved || isLocalModified) {
				var m4fLocal: IMat4 = this._m4fLocalMatrix;
				var m4fWorld: IMat4 = this._m4fWorldMatrix;

				var m4fOrient: IMat4 = Node._m4fTemp1;
				var v3fTemp: IVec3 = Node._v3fTemp1;

				var pWorldData: Float32Array = m4fWorld.data;
				var pOrientData: Float32Array = m4fOrient.data;

				this._qRotation.toMat4(m4fOrient);

				m4fOrient.setTranslation(this._v3fTranslation);
				m4fOrient.scaleRight(this._v3fScale);
				m4fOrient.multiply(m4fLocal);

				//console.log("recalc: " + this.toString() + " : " + this._eInheritance);
				//console.error(m4fOrient.toString());

				if (this._pParent && this._eInheritance !== ENodeInheritance.NONE) {
					var m4fParent: IMat4 = (<Node>this._pParent).getWorldMatrix();
					var pParentData: Float32Array = m4fParent.data;

					if (this._eInheritance === ENodeInheritance.ALL) {
						m4fParent.multiply(m4fOrient, m4fWorld);
					}
					else if (this._eInheritance === ENodeInheritance.POSITION) {
						m4fWorld.set(m4fOrient);

						pWorldData[__14] = pParentData[__14] + pOrientData[__14];
						pWorldData[__24] = pParentData[__24] + pOrientData[__24];
						pWorldData[__34] = pParentData[__34] + pOrientData[__34];
					}
					else if (this._eInheritance === ENodeInheritance.ROTPOSITION) {
						//FIXME: add faster way to compute this inheritance...
						logger.assert(m4fParent.toMat3(Node._m3fTemp1).decompose(Node._q4fTemp1, Node._v3fTemp1),
							"could not decompose.");

						var m4fParentNoScale: IMat4 = Node._q4fTemp1.toMat4(Node._m4fTemp2);

						m4fParentNoScale.data[__14] = pParentData[__14];
						m4fParentNoScale.data[__24] = pParentData[__24];
						m4fParentNoScale.data[__34] = pParentData[__34];

						m4fParentNoScale.multiply(m4fOrient, m4fWorld);
					}
					else if (this._eInheritance === ENodeInheritance.ROTSCALE) {
						//3x3 parent world matrix
						var p11 = pParentData[__11], p12 = pParentData[__12],
							p13 = pParentData[__13];
						var p21 = pParentData[__21], p22 = pParentData[__22],
							p23 = pParentData[__23];
						var p31 = pParentData[__31], p32 = pParentData[__32],
							p33 = pParentData[__33];

						//3x3 local matrix
						var l11 = pOrientData[__11], l12 = pOrientData[__12],
							l13 = pOrientData[__13];
						var l21 = pOrientData[__21], l22 = pOrientData[__22],
							l23 = pOrientData[__23];
						var l31 = pOrientData[__31], l32 = pOrientData[__32],
							l33 = pOrientData[__33];

						//parent x local with local world pos.
						pWorldData[__11] = p11 * l11 + p12 * l21 + p13 * l31;
						pWorldData[__12] = p11 * l12 + p12 * l22 + p13 * l32;
						pWorldData[__13] = p11 * l13 + p12 * l23 + p13 * l33;
						pWorldData[__14] = pOrientData[__14];
						pWorldData[__21] = p21 * l11 + p22 * l21 + p23 * l31;
						pWorldData[__22] = p21 * l12 + p22 * l22 + p23 * l32;
						pWorldData[__23] = p21 * l13 + p22 * l23 + p23 * l33;
						pWorldData[__24] = pOrientData[__24];
						pWorldData[__31] = p31 * l11 + p32 * l21 + p33 * l31;
						pWorldData[__32] = p31 * l12 + p32 * l22 + p33 * l32;
						pWorldData[__33] = p31 * l13 + p32 * l23 + p33 * l33;
						pWorldData[__34] = pOrientData[__34];

						pWorldData[__41] = pOrientData[__41];
						pWorldData[__42] = pOrientData[__42];
						pWorldData[__43] = pOrientData[__43];
						pWorldData[__44] = pOrientData[__44];
					}
				}
				else {
					m4fWorld.set(m4fOrient);
				}

				this._v3fWorldPosition.x = pWorldData[__14];
				this._v3fWorldPosition.y = pWorldData[__24];
				this._v3fWorldPosition.z = pWorldData[__34];

				// set the flag that our world matrix has changed
				this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewWorldMatrix);
				// and it's inverse & vectors are out of date
				this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_RebuildInverseWorldMatrix);
				this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_RebuildNormalMatrix);

				//this._iUpdateFlags = bf.clearAll(this._iUpdateFlags, bf.flag(ENodeUpdateFlags.k_NewLocalMatrix) |
				//	bf.flag(ENodeUpdateFlags.k_NewOrientation));

				return true;
			}

			return false;
		}


		setWorldPosition(v3fPosition: IVec3): INode;
		setWorldPosition(fX: float, fY: float, fZ: float): INode;
		setWorldPosition(fX?: any, fY?: any, fZ?: any): INode {
			var pPos: IVec3 = arguments.length === 1 ? arguments[0] : Vec3.temp(fX, fY, fZ);

			//target world matrix
			var Au: IMat4 = Mat4.temp(1.);
			Au.setTranslation(pPos);

			//original translation matrices of this node
			var A0: IMat4 = Mat4.temp(1.);
			A0.setTranslation(this.getWorldPosition());

			//inversed A0
			var A0inv: IMat4 = A0.inverse(Mat4.temp());
			//transformation matrix A0 to Au
			var C: IMat4 = Au.multiply(A0inv, Mat4.temp());

			//parent world matrix
			var Mp: IMat4 = isNull(this.getParent()) ? Mat4.temp(1.) : Mat4.temp((<Node>this.getParent()).getWorldMatrix());
			//this orientation matrix (orientation + sclae + translation)
			var Mo: IMat4 = Mat4.temp();

			//assemble local orientaion matrix
			this.getLocalOrientation().toMat4(Mo);
			Mo.setTranslation(this.getLocalPosition());
			Mo.scaleRight(this.getLocalScale());

			//this local matrix
			var Ml: IMat4 = Mat4.temp(this.getLocalMatrix());

			//inversed parent world matrix
			var Mpinv: IMat4 = Mp.inverse(Mat4.temp());
			//inversed this orientation matrix
			var Moinv: IMat4 = Mo.inverse(Mat4.temp());

			//transformation matrix Ml to Mlc
			var Cc: IMat4 = Moinv.multiply(Mpinv, Mat4.temp()).multiply(C).multiply(Mp).multiply(Mo);
			//modified local matrix, that translate node to pPos world position
			var Mlc: IMat4 = Cc.multiply(Ml, Mat4.temp());

			this._m4fLocalMatrix.setTranslation(Mlc.getTranslation());

			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewLocalMatrix);
			return this;
		}


		setPosition(v3fPosition: IVec3): INode;
		setPosition(fX: float, fY: float, fZ: float): INode;
		setPosition(fX?: any, fY?: any, fZ?: any): INode {
			var pPos: IVec3 = arguments.length === 1 ? arguments[0] : Vec3.temp(fX, fY, fZ);
			var v3fTranslation: IVec3 = this._v3fTranslation;

			v3fTranslation.set(pPos);

			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRelPosition(v3fPosition: IVec3): INode;
		setRelPosition(fX: float, fY: float, fZ: float): INode;
		setRelPosition(fX?: any, fY?: any, fZ?: any): INode {
			var pPos: IVec3 = arguments.length === 1 ? arguments[0] : Vec3.temp(fX, fY, fZ);
			var v3fTranslation: IVec3 = this._v3fTranslation;

			this._qRotation.multiplyVec3(pPos);
			v3fTranslation.set(pPos);

			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		addPosition(v3fPosition: IVec3): INode;
		addPosition(fX: float, fY: float, fZ: float): INode;
		addPosition(fX?: any, fY?: any, fZ?: any): INode {
			var pPos: IVec3 = arguments.length === 1 ? arguments[0] : Vec3.temp(fX, fY, fZ);
			var v3fTranslation: IVec3 = this._v3fTranslation;

			v3fTranslation.add(pPos);

			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		addRelPosition(v3fPosition: IVec3): INode;
		addRelPosition(fX: float, fY: float, fZ: float): INode;
		addRelPosition(fX?: any, fY?: any, fZ?: any): INode {
			var pPos: IVec3 = arguments.length === 1 ? arguments[0] : Vec3.temp(fX, fY, fZ);
			var v3fTranslation: IVec3 = this._v3fTranslation;

			this._qRotation.multiplyVec3(pPos);
			v3fTranslation.add(pPos);

			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRotationByMatrix(m3fRotation: IMat3): INode;
		setRotationByMatrix(m4fRotation: IMat4): INode;
		setRotationByMatrix(matrix: any): INode {
			matrix.toQuat4(this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRotationByAxisAngle(v3fAxis: IVec3, fAngle: float): INode {
			Quat4.fromAxisAngle(v3fAxis, fAngle, this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRotationByForwardUp(v3fForward: IVec3, v3fUp: IVec3): INode {
			Quat4.fromForwardUp(v3fForward, v3fUp, this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRotationByEulerAngles(fYaw: float, fPitch: float, fRoll: float): INode {
			Quat4.fromYawPitchRoll(fYaw, fPitch, fRoll, this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRotationByXYZAxis(fX: float, fY: float, fZ: float): INode {
			Quat4.fromYawPitchRoll(fY, fX, fZ, this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		setRotation(q4fRotation: IQuat4): INode {
			this._qRotation.set(q4fRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		addRelRotationByMatrix(m3fRotation: IMat3): INode;
		addRelRotationByMatrix(m4fRotation: IMat4): INode;
		addRelRotationByMatrix(matrix: any): INode {
			this.addRelRotation(arguments[0].toQuat4(Node._q4fTemp1));
			return this;
		}

		addRelRotationByAxisAngle(v3fAxis: IVec3, fAngle: float): INode {
			this.addRelRotation(Quat4.fromAxisAngle(v3fAxis, fAngle, Node._q4fTemp1));
			return this;
		}

		addRelRotationByForwardUp(v3fForward: IVec3, v3fUp: IVec3): INode {
			this.addRelRotation(Quat4.fromForwardUp(v3fForward, v3fUp, Node._q4fTemp1));
			return this;
		}

		addRelRotationByEulerAngles(fYaw: float, fPitch: float, fRoll: float): INode {
			this.addRelRotation(Quat4.fromYawPitchRoll(fYaw, fPitch, fRoll, Node._q4fTemp1));
			return this;
		}

		addRelRotationByXYZAxis(fX: float, fY: float, fZ: float): INode {
			this.addRelRotation(Quat4.fromYawPitchRoll(fY, fX, fZ, Node._q4fTemp1));
			return this;
		}

		addRelRotation(q4fRotation: IQuat4): INode {
			this._qRotation.multiply(q4fRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		addRotationByMatrix(m3fRotation: IMat3): INode;
		addRotationByMatrix(m4fRotation: IMat4): INode;
		addRotationByMatrix(matrix: any): INode {
			this.addRotation(arguments[0].toQuat4(Node._q4fTemp1));
			return this;
		}

		addRotationByAxisAngle(v3fAxis: IVec3, fAngle: float): INode {
			this.addRotation(Quat4.fromAxisAngle(v3fAxis, fAngle, Node._q4fTemp1));
			return this;
		}

		addRotationByForwardUp(v3fForward: IVec3, v3fUp: IVec3): INode {
			this.addRotation(Quat4.fromForwardUp(v3fForward, v3fUp, Node._q4fTemp1));
			return this;
		}

		addRotationByEulerAngles(fYaw: float, fPitch: float, fRoll: float): INode {
			this.addRotation(Quat4.fromYawPitchRoll(fYaw, fPitch, fRoll, Node._q4fTemp1));
			return this;
		}

		addRotationByXYZAxis(fX: float, fY: float, fZ: float): INode {
			this.addRotation(Quat4.fromYawPitchRoll(fY, fX, fZ, Node._q4fTemp1));
			return this;
		}

		addRotation(q4fRotation: IQuat4): INode {
			q4fRotation.multiply(this._qRotation, this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		addOrbitRotationByMatrix(m3fRotation: IMat3): INode;
		addOrbitRotationByMatrix(m4fRotation: IMat4): INode;
		addOrbitRotationByMatrix(matrix: any): INode {
			this.addOrbitRotation(arguments[0].toQuat4(Node._q4fTemp1));
			return this;
		}

		addOrbitRotationByAxisAngle(v3fAxis: IVec3, fAngle: float): INode {
			this.addOrbitRotation(Quat4.fromAxisAngle(v3fAxis, fAngle, Node._q4fTemp1));
			return this;
		}

		addOrbitRotationByForwardUp(v3fForward: IVec3, v3fUp: IVec3): INode {
			this.addOrbitRotation(Quat4.fromForwardUp(v3fForward, v3fUp, Node._q4fTemp1));
			return this;
		}

		addOrbitRotationByEulerAngles(fYaw: float, fPitch: float, fRoll: float): INode {
			this.addOrbitRotation(Quat4.fromYawPitchRoll(fYaw, fPitch, fRoll, Node._q4fTemp1));
			return this;
		}

		addOrbitRotationByXYZAxis(fX: float, fY: float, fZ: float): INode {
			this.addOrbitRotation(Quat4.fromYawPitchRoll(fY, fX, fZ, Node._q4fTemp1));
			return this;
		}

		addOrbitRotation(q4fRotation: IQuat4): INode {
			q4fRotation.multiplyVec3(this._v3fTranslation);
			q4fRotation.multiply(this._qRotation, this._qRotation);
			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}


		scale(fScale: float): INode;
		scale(v3fScale: IVec3): INode;
		scale(fX: float, fY: float, fZ: float): INode;
		scale(fX: any, fY?: any, fZ?: any): INode {
			var pScale: IVec3 = arguments.length === 1 ? (isNumber(arguments[0]) ? Vec3.temp(fX) : arguments[0]) : Vec3.temp(fX, fY, fZ);
			var v3fScale: IVec3 = this._v3fScale;

			v3fScale.scale(pScale);

			this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewOrientation);
			return this;
		}

		lookAt(v3fFrom: IVec3, v3fCenter: IVec3, v3fUp?: IVec3): INode;
		lookAt(v3fCenter: IVec3, v3fUp?: IVec3): INode;
		lookAt(v3f?): INode {
			var v3fFrom: IVec3, v3fCenter: IVec3, v3fUp: IVec3;

			this.update();

			if (arguments.length < 3) {
				v3fFrom = this.getWorldPosition();
				v3fCenter = <IVec3>arguments[0];
				v3fUp = <IVec3>arguments[1];
			}
			else {
				v3fFrom = <IVec3>arguments[0];
				v3fCenter = <IVec3>arguments[1];
				v3fUp = <IVec3>arguments[2];
			}

			v3fUp = v3fUp || Vec3.temp(0., 1., 0.);

			var v3fParentPos: IVec3 = (<Node>this.getParent()).getWorldPosition();
			var m4fTemp: IMat4 = Mat4.lookAt(v3fFrom, v3fCenter, v3fUp, Mat4.temp()).inverse();
			var pData: Float32Array = m4fTemp.data;

			switch (this._eInheritance) {
				case ENodeInheritance.ALL:
					(<Node>this._pParent).getInverseWorldMatrix().multiply(m4fTemp, m4fTemp);
					m4fTemp.toQuat4(this._qRotation);
					this.setPosition(pData[__14], pData[__24], pData[__34]);
					break;
				case ENodeInheritance.ROTSCALE:
					var m3fTemp = m4fTemp.toMat3();
					m3fTemp = (<Node>this._pParent).getInverseWorldMatrix().toMat3().multiply(m3fTemp, Mat3.temp());
					m3fTemp.toQuat4(this._qRotation);
					this.setPosition(pData[__14], pData[__24], pData[__34]);
					break;
				default:
					m4fTemp.toQuat4(this._qRotation);
					this.setPosition(
						pData[__14] - v3fParentPos.x,
						pData[__24] - v3fParentPos.y,
						pData[__34] - v3fParentPos.z);
			}

			this.update();
			return this;
		}



		attachToParent(pParent: INode): boolean {
			if (super.attachToParent(pParent)) {
				// adjust my local matrix to be relative to this new parent
				var m4fInvertedParentMatrix: IMat4 = Mat4.temp();
				(<Node>this._pParent)._m4fWorldMatrix.inverse(m4fInvertedParentMatrix);
				this._iUpdateFlags = bf.setBit(this._iUpdateFlags, ENodeUpdateFlags.k_NewWorldMatrix);

				return true;
			}

			return false;
		}

		detachFromParent(): boolean {
			if (super.detachFromParent()) {
				this._m4fWorldMatrix.identity();
				return true;
			}

			return false;
		}

		toString(isRecursive: boolean = false, iDepth: int = 0): string {
			if (config.DEBUG) {

				if (!isRecursive) {
					return '<node' + (this.getName() ? " " + this.getName() : "") + '>';
				}

				// var pSibling: IEntity = this.sibling;
				var pChild: INode = <INode>this.getChild();
				var s = "";

				for (var i = 0; i < iDepth; ++i) {
					s += ':  ';
				}

				s += '+----[depth: ' + this.getDepth() + ']' + this.toString() + '\n';
				/*"[updated: " + this.isUpdated() + ", childs updated: " + this.hasUpdatedSubNodes() + ", new wm: " + this.isWorldMatrixNew() + "]" +*/
				while (pChild) {
					s += pChild.toString(true, iDepth + 1);
					pChild = <INode>pChild.getSibling();
				}

				// if (pSibling) {
				// s += pSibling.toString(true, iDepth);
				// }
				// 
				return s;
			}
			return null;

		}

		private static _v3fTemp1: IVec3 = new Vec3();
		private static _v4fTemp1: IVec4 = new Vec4();
		private static _m3fTemp1: IMat3 = new Mat3();
		private static _m4fTemp1: IMat4 = new Mat4();
		private static _m4fTemp2: IMat4 = new Mat4();
		private static _q4fTemp1: IQuat4 = new Quat4();
	}
}
