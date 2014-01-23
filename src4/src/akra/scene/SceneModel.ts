/// <reference path="../idl/ISceneModel.ts" />
/// <reference path="../idl/IMesh.ts" />
/// <reference path="../idl/IMeshSubset.ts" />

/// <reference path="../model/Mesh.ts" />
/// <reference path="SceneObject.ts" />


module akra.scene {
	export class SceneModel extends SceneObject implements ISceneModel {
		private _pMesh: IMesh = null;
		private _bShow: boolean = true;

		getVisible(): boolean {
			return this._bShow;
		}

		setVisible(bValue: boolean): void {
			this._bShow = bValue;
		}

		getMesh(): IMesh {
			return this._pMesh;
		}

		setMesh(pMesh: IMesh): void {
			if (!isNull(this._pMesh)) {
				this.accessLocalBounds().set(0.01, 0.01, 0.01);
				this.getScene().postUpdate.disconnect(this._pMesh, this._pMesh.update);
				//this._pMesh.disconnect(this.scene, SIGNAL(postUpdate), SLOT(update));
				this._pMesh = null;
			}

			if (!isNull(pMesh)) {
				this.accessLocalBounds().set(pMesh.boundingBox);
				this._pMesh = pMesh;
				//FIXME: event handing used out of object, bad practice..
				this.getScene().postUpdate.connect(this._pMesh, this._pMesh.update);
				//pMesh.connect(this.scene, SIGNAL(postUpdate), SLOT(update));
			}
		}

		getTotalRenderable(): uint {
			return isNull(this._pMesh) || !this._bShow ? 0 : this._pMesh.length;
		}

		constructor(pScene: IScene3d) {
			super(pScene, EEntityTypes.MODEL);
		}

		getRenderable(i: uint = 0): IRenderableObject {
			if (isNull(this._pMesh)) {
				logger.warn(this);
			}
			return this._pMesh.getSubset(i);
		}

		get shadow(): boolean {
			return this._pMesh.shadow;
		}

		set shadow(bValue) {
			this._pMesh.shadow = bValue;
		}


		isVisible(): boolean {
			return this._bShow;
		}

		toString(isRecursive: boolean = false, iDepth: uint = 0): string {
			if (config.DEBUG) {
				if (!isRecursive) {
					var sData: string = "<model" + (this.getName() ? " " + this.getName() : "") + "(" + (isNull(this._pMesh) ? 0 : this._pMesh.length) + ")" + '>'/* + " height: " + this.worldPosition.y*/;

					if (!isNull(this._pMesh)) {
						sData += "( " + this._pMesh.name + " )";
					}

					return sData;
				}

				return super.toString(isRecursive, iDepth);
			}

			return null;
		}

		static isModel(pEntity: IEntity): boolean {
			return !isNull(pEntity) && pEntity.getType() === EEntityTypes.MODEL;
		}
	}
}
